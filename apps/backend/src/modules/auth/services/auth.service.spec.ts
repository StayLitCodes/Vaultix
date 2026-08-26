import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, TooManyRequestsException, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { AuthService } from './auth.service';
import { UserService } from '../../user/user.service';
import { EmailVerification } from '../../user/entities/email-verification.entity';
import { IpfsService } from '../../ipfs/ipfs.service';
import { EmailService } from '../../../email/email.service';
import { EmailRateLimiterService } from '../../../email/email-rate-limiter.service';
import { PreferenceService } from '../../../notifications/preference.service';
import { NotificationChannel } from '../../../notifications/enums/notification-event.enum';
import { User } from '../../user/entities/user.entity';
import { UserRole } from '../../user/entities/user-role.enum';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    walletAddress: 'GTEST123',
    email: 'alice@example.com',
    displayName: 'Alice',
    emailVerified: false,
    isActive: true,
    role: UserRole.USER,
    nonce: undefined,
    avatarUrl: undefined,
    bio: undefined,
    preferredAsset: 'XLM',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
}

function makeVerification(overrides = {}): EmailVerification {
  return {
    id: 'ev-1',
    userId: 'user-1',
    token: 'test-token',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    isUsed: false,
    createdAt: new Date(),
    user: makeUser(),
    ...overrides,
  } as EmailVerification;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthService – email delivery', () => {
  let service: AuthService;
  let emailService: jest.Mocked<EmailService>;
  let rateLimiter: EmailRateLimiterService;
  let preferenceService: jest.Mocked<PreferenceService>;
  let userService: jest.Mocked<UserService>;
  let emailVerificationRepo: jest.Mocked<Repository<EmailVerification>>;

  const configValues: Record<string, unknown> = {
    'email.verificationBaseUrl': 'https://app.vaultix.io/auth/verify-email',
    JWT_SECRET: 'test-secret-that-is-at-least-32-chars-long!!',
    EMAIL_ENABLED: 'true',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: {
            findById: jest.fn(),
            findByWalletAddress: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            createRefreshToken: jest.fn(),
            findRefreshToken: jest.fn(),
            invalidateRefreshToken: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('signed-token'),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(
              (key: string, defaultValue?: unknown) =>
                configValues[key] ?? defaultValue,
            ),
          },
        },
        {
          provide: getRepositoryToken(EmailVerification),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: IpfsService,
          useValue: {
            uploadFile: jest.fn(),
            getGatewayUrl: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendEmail: jest.fn(),
          },
        },
        {
          provide: EmailRateLimiterService,
          useClass: EmailRateLimiterService, // real instance so we can test state
        },
        {
          provide: PreferenceService,
          useValue: {
            getUserPreferences: jest.fn(),
            seedDefaultPreferences: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    emailService = module.get(EmailService);
    rateLimiter = module.get<EmailRateLimiterService>(EmailRateLimiterService);
    preferenceService = module.get(PreferenceService);
    userService = module.get(UserService);
    emailVerificationRepo = module.get(getRepositoryToken(EmailVerification));
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Reset rate limiter state between tests
    rateLimiter.reset('user-1');
    rateLimiter.reset('user-2');
  });

  // ── Basic send ────────────────────────────────────────────────────────────

  describe('sendEmailVerification', () => {
    it('should queue a verification email when all conditions are met', async () => {
      const user = makeUser();
      const verification = makeVerification();

      userService.findById.mockResolvedValue(user);
      preferenceService.getUserPreferences.mockResolvedValue([
        { channel: NotificationChannel.EMAIL, enabled: true, eventTypes: [], userId: user.id } as any,
      ]);
      emailVerificationRepo.create.mockReturnValue(verification);
      emailVerificationRepo.save.mockResolvedValue(verification);
      emailService.sendEmail.mockResolvedValue({} as any);

      await service.sendEmailVerification('user-1');

      expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
      const [to, subject, html, text] = (emailService.sendEmail as jest.Mock).mock.calls[0] as [string, string, string, string];
      expect(to).toBe('alice@example.com');
      expect(subject).toContain('Verify your email');
      expect(subject).toContain('Vaultix');
      expect(html).toBeDefined();
      expect(text).toBeDefined();
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      userService.findById.mockResolvedValue(null);
      await expect(service.sendEmailVerification('missing-user')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when user has no email', async () => {
      userService.findById.mockResolvedValue(makeUser({ email: undefined }));
      preferenceService.getUserPreferences.mockResolvedValue([]);
      await expect(service.sendEmailVerification('user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });
  });

  // ── Rate limiting ─────────────────────────────────────────────────────────

  describe('rate limiting', () => {
    it('should allow up to MAX_PER_HOUR sends', async () => {
      const user = makeUser();
      userService.findById.mockResolvedValue(user);
      preferenceService.getUserPreferences.mockResolvedValue([
        { channel: NotificationChannel.EMAIL, enabled: true, eventTypes: [], userId: user.id } as any,
      ]);
      emailVerificationRepo.create.mockReturnValue(makeVerification());
      emailVerificationRepo.save.mockResolvedValue(makeVerification());
      emailService.sendEmail.mockResolvedValue({} as any);

      const max = EmailRateLimiterService.MAX_PER_HOUR; // 3
      for (let i = 0; i < max; i++) {
        await expect(service.sendEmailVerification('user-1')).resolves.toBeUndefined();
      }
      expect(emailService.sendEmail).toHaveBeenCalledTimes(max);
    });

    it('should throw TooManyRequestsException on the (MAX+1)th send', async () => {
      const user = makeUser();
      userService.findById.mockResolvedValue(user);
      preferenceService.getUserPreferences.mockResolvedValue([
        { channel: NotificationChannel.EMAIL, enabled: true, eventTypes: [], userId: user.id } as any,
      ]);
      emailVerificationRepo.create.mockReturnValue(makeVerification());
      emailVerificationRepo.save.mockResolvedValue(makeVerification());
      emailService.sendEmail.mockResolvedValue({} as any);

      const max = EmailRateLimiterService.MAX_PER_HOUR;
      for (let i = 0; i < max; i++) {
        await service.sendEmailVerification('user-1');
      }

      await expect(service.sendEmailVerification('user-1')).rejects.toThrow(
        TooManyRequestsException,
      );
      // No extra email queued after the limit
      expect(emailService.sendEmail).toHaveBeenCalledTimes(max);
    });

    it('should track rate limits independently per user', async () => {
      const user1 = makeUser({ id: 'user-1', email: 'u1@example.com' });
      const user2 = makeUser({ id: 'user-2', email: 'u2@example.com' });

      userService.findById
        .mockResolvedValueOnce(user1)
        .mockResolvedValueOnce(user2);

      preferenceService.getUserPreferences.mockResolvedValue([
        { channel: NotificationChannel.EMAIL, enabled: true, eventTypes: [], userId: 'any' } as any,
      ]);
      emailVerificationRepo.create.mockReturnValue(makeVerification());
      emailVerificationRepo.save.mockResolvedValue(makeVerification());
      emailService.sendEmail.mockResolvedValue({} as any);

      // Exhaust user-1's limit
      for (let i = 0; i < EmailRateLimiterService.MAX_PER_HOUR; i++) {
        rateLimiter.tryConsume('user-1');
      }

      // user-1 is throttled but user-2 should succeed
      await expect(service.sendEmailVerification('user-1')).rejects.toThrow(
        TooManyRequestsException,
      );
      await expect(service.sendEmailVerification('user-2')).resolves.toBeUndefined();
    });
  });

  // ── Notification preference opt-out ───────────────────────────────────────

  describe('notification preferences', () => {
    it('should skip sending when email channel is disabled in preferences', async () => {
      const user = makeUser();
      userService.findById.mockResolvedValue(user);
      preferenceService.getUserPreferences.mockResolvedValue([
        { channel: NotificationChannel.EMAIL, enabled: false, eventTypes: [], userId: user.id } as any,
      ]);

      await service.sendEmailVerification('user-1');

      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it('should still send when no email preference record exists (default allow)', async () => {
      const user = makeUser();
      userService.findById.mockResolvedValue(user);
      // Return prefs for other channels only — no EMAIL pref
      preferenceService.getUserPreferences.mockResolvedValue([
        { channel: NotificationChannel.WEBHOOK, enabled: false, eventTypes: [], userId: user.id } as any,
      ]);
      emailVerificationRepo.create.mockReturnValue(makeVerification());
      emailVerificationRepo.save.mockResolvedValue(makeVerification());
      emailService.sendEmail.mockResolvedValue({} as any);

      await service.sendEmailVerification('user-1');

      expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    });

    it('should still send if preference lookup throws (graceful degradation)', async () => {
      const user = makeUser();
      userService.findById.mockResolvedValue(user);
      preferenceService.getUserPreferences.mockRejectedValue(new Error('DB error'));
      emailVerificationRepo.create.mockReturnValue(makeVerification());
      emailVerificationRepo.save.mockResolvedValue(makeVerification());
      emailService.sendEmail.mockResolvedValue({} as any);

      await expect(service.sendEmailVerification('user-1')).resolves.toBeUndefined();
      expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    });
  });

  // ── SMTP error handling ───────────────────────────────────────────────────

  describe('SMTP error handling', () => {
    it('should NOT throw when emailService.sendEmail rejects (SMTP crash isolation)', async () => {
      const user = makeUser();
      userService.findById.mockResolvedValue(user);
      preferenceService.getUserPreferences.mockResolvedValue([
        { channel: NotificationChannel.EMAIL, enabled: true, eventTypes: [], userId: user.id } as any,
      ]);
      emailVerificationRepo.create.mockReturnValue(makeVerification());
      emailVerificationRepo.save.mockResolvedValue(makeVerification());
      emailService.sendEmail.mockRejectedValue(new Error('SMTP connection refused'));

      // Should resolve without throwing — SMTP errors must not crash the request
      await expect(service.sendEmailVerification('user-1')).resolves.toBeUndefined();
    });

    it('should still save the verification token even when send fails', async () => {
      const user = makeUser();
      userService.findById.mockResolvedValue(user);
      preferenceService.getUserPreferences.mockResolvedValue([
        { channel: NotificationChannel.EMAIL, enabled: true, eventTypes: [], userId: user.id } as any,
      ]);
      emailVerificationRepo.create.mockReturnValue(makeVerification());
      emailVerificationRepo.save.mockResolvedValue(makeVerification());
      emailService.sendEmail.mockRejectedValue(new Error('SMTP down'));

      await service.sendEmailVerification('user-1');

      expect(emailVerificationRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  // ── Branded template content ──────────────────────────────────────────────

  describe('email template', () => {
    beforeEach(() => {
      const user = makeUser();
      userService.findById.mockResolvedValue(user);
      preferenceService.getUserPreferences.mockResolvedValue([
        { channel: NotificationChannel.EMAIL, enabled: true, eventTypes: [], userId: user.id } as any,
      ]);
      emailVerificationRepo.create.mockReturnValue(makeVerification());
      emailVerificationRepo.save.mockResolvedValue(makeVerification());
      emailService.sendEmail.mockResolvedValue({} as any);
    });

    it('should include the Vaultix brand in the HTML body', async () => {
      await service.sendEmailVerification('user-1');
      const html = (emailService.sendEmail as jest.Mock).mock.calls[0][2] as string;
      expect(html).toContain('Vaultix');
    });

    it('should include a verification link in the HTML body', async () => {
      await service.sendEmailVerification('user-1');
      const html = (emailService.sendEmail as jest.Mock).mock.calls[0][2] as string;
      expect(html).toContain('verify-email');
    });

    it('should include an expiry warning in the HTML body', async () => {
      await service.sendEmailVerification('user-1');
      const html = (emailService.sendEmail as jest.Mock).mock.calls[0][2] as string;
      expect(html).toContain('24 hours');
    });

    it('should include an unsubscribe/preferences footer in the HTML body', async () => {
      await service.sendEmailVerification('user-1');
      const html = (emailService.sendEmail as jest.Mock).mock.calls[0][2] as string;
      expect(html.toLowerCase()).toMatch(/notification preferences|unsubscribe/);
    });

    it('should include a plain-text alternative with unsubscribe notice', async () => {
      await service.sendEmailVerification('user-1');
      const text = (emailService.sendEmail as jest.Mock).mock.calls[0][3] as string;
      expect(text).toContain('verify');
      expect(text.toLowerCase()).toMatch(/notification preferences|unsubscribe/);
    });

    it('should personalise the greeting when displayName is present', async () => {
      await service.sendEmailVerification('user-1');
      const html = (emailService.sendEmail as jest.Mock).mock.calls[0][2] as string;
      expect(html).toContain('Alice');
    });

    it('should use a generic greeting when displayName is absent', async () => {
      userService.findById.mockResolvedValue(makeUser({ displayName: undefined }));
      await service.sendEmailVerification('user-1');
      const html = (emailService.sendEmail as jest.Mock).mock.calls[0][2] as string;
      // Ensure no undefined leaks into the template
      expect(html).not.toContain('undefined');
      expect(html).toContain('Hi there,');
    });
  });
});
