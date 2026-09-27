import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmailVerification } from '../../user/entities/email-verification.entity';
import { IpfsService } from '../../ipfs/ipfs.service';
import { EmailService } from '../../../email/email.service';
import { EmailTemplatesService } from '../../../email/email-templates.service';
import { PreferenceService } from '../../../notifications/preference.service';

// Mock Stellar SDK
jest.mock('stellar-sdk', () => ({
  Keypair: {
    fromPublicKey: jest.fn().mockReturnValue({
      verify: jest.fn().mockReturnValue(true),
    }),
  },
}));

describe('AuthService', () => {
  let service: AuthService;
  let userService: jest.Mocked<UserService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let emailVerificationRepository: any;
  let ipfsService: any;
  let emailService: { sendEmail: jest.Mock };
  let preferenceService: { seedDefaultPreferences: jest.Mock };

  const mockUser = {
    id: 'user-id',
    walletAddress: 'GD...123',
    nonce: 'test-nonce',
    nonceExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
    isActive: true,
  };

  const mockRefreshToken = {
    token: 'refresh-token',
    user: mockUser,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: {
            findByWalletAddress: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            setChallengeNonce: jest.fn(),
            consumeChallenge: jest.fn(),
            findRefreshToken: jest.fn(),
            invalidateRefreshToken: jest.fn(),
            atomicRotateRefreshToken: jest.fn(),
            findById: jest.fn(),
            createRefreshToken: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('access-token'),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('jwt-secret'),
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
          provide: EmailTemplatesService,
          useValue: {
            renderVerification: jest.fn(
              (data: { verificationUrl: string }) => ({
                subject: 'Verify your email address - Vaultix',
                html: `<p><a href="${data.verificationUrl}">Verify email address</a></p>`,
                text: `Verify: ${data.verificationUrl}`,
              }),
            ),
          },
        },
        {
          provide: PreferenceService,
          useValue: {
            seedDefaultPreferences: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get(UserService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    emailVerificationRepository = module.get(
      getRepositoryToken(EmailVerification),
    );
    ipfsService = module.get(IpfsService);
    emailService = module.get(EmailService);
    preferenceService = module.get(PreferenceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateChallenge', () => {
    it('should create a new user if not exists', async () => {
      userService.findByWalletAddress.mockResolvedValue(null);
      userService.create.mockResolvedValue(mockUser as any);

      const result = await service.generateChallenge('GD...123');

      expect(result).toHaveProperty('nonce');
      expect(result).toHaveProperty('message');
      expect(userService.create).toHaveBeenCalledWith({
        walletAddress: 'GD...123',
        nonce: expect.any(String),
        nonceExpiresAt: expect.any(Date),
      });
    });

    it('should seed default notification preferences for a new user', async () => {
      userService.findByWalletAddress.mockResolvedValue(null);
      userService.create.mockResolvedValue(mockUser as any);

      await service.generateChallenge('GD...123');

      expect(preferenceService.seedDefaultPreferences).toHaveBeenCalledWith(
        mockUser.id,
      );
    });

    it('should not seed preferences when the user already exists', async () => {
      userService.findByWalletAddress.mockResolvedValue(mockUser as any);
      userService.setChallengeNonce.mockResolvedValue(undefined);

      await service.generateChallenge('GD...123');

      expect(preferenceService.seedDefaultPreferences).not.toHaveBeenCalled();
    });

    it('should update nonce if user exists', async () => {
      userService.findByWalletAddress.mockResolvedValue(mockUser as any);
      userService.setChallengeNonce.mockResolvedValue(undefined);

      const result = await service.generateChallenge('GD...123');

      expect(result).toHaveProperty('nonce');
      expect(userService.setChallengeNonce).toHaveBeenCalledWith(
        mockUser.id,
        expect.any(String),
        expect.any(Date),
      );
    });

    it('should return the signing message containing the nonce', async () => {
      userService.findByWalletAddress.mockResolvedValue(null);
      userService.create.mockResolvedValue(mockUser as any);

      const result = await service.generateChallenge('GD...123');

      expect(result.message).toBe(
        `Sign this message to authenticate with Vaultix: ${result.nonce}`,
      );
    });
  });

  describe('verifySignature', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      userService.findByWalletAddress.mockResolvedValue(null);

      await expect(service.verifySignature('sig', 'GD...123')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return tokens on valid signature', async () => {
      userService.findByWalletAddress.mockResolvedValue(mockUser as any);
      userService.consumeChallenge.mockResolvedValue(true);
      userService.createRefreshToken.mockResolvedValue({} as any);

      const result = await service.verifySignature('sig', 'GD...123');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(userService.consumeChallenge).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.nonce,
      );
    });

    it('should reject an inactive user', async () => {
      userService.findByWalletAddress.mockResolvedValue({
        ...mockUser,
        isActive: false,
      } as any);

      await expect(service.verifySignature('sig', 'GD...123')).rejects.toThrow(
        'Account is not active',
      );
      expect(userService.consumeChallenge).not.toHaveBeenCalled();
    });

    it('should reject an expired challenge', async () => {
      userService.findByWalletAddress.mockResolvedValue({
        ...mockUser,
        nonceExpiresAt: new Date(Date.now() - 1000),
      } as any);

      await expect(service.verifySignature('sig', 'GD...123')).rejects.toThrow(
        'Challenge expired',
      );
      expect(userService.consumeChallenge).not.toHaveBeenCalled();
    });

    it('should reject when the challenge was already consumed (replay)', async () => {
      userService.findByWalletAddress.mockResolvedValue(mockUser as any);
      userService.consumeChallenge.mockResolvedValue(false);

      await expect(service.verifySignature('sig', 'GD...123')).rejects.toThrow(
        'Invalid challenge',
      );
      expect(userService.createRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('refreshAccessToken', () => {
    it('should return new tokens on successful rotation', async () => {
      userService.atomicRotateRefreshToken.mockResolvedValue({
        consumed: {
          ...mockRefreshToken,
          user: mockUser,
        },
        newToken: 'new-refresh-token',
        newExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      } as any);

      const result = await service.refreshAccessToken('refresh-token');

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(userService.atomicRotateRefreshToken).toHaveBeenCalledWith(
        'refresh-token',
        expect.any(String),
        expect.any(Date),
      );
    });

    it('should throw ConflictException on replay (already consumed)', async () => {
      userService.atomicRotateRefreshToken.mockRejectedValue(
        new Error('REFRESH_TOKEN_ALREADY_CONSUMED'),
      );

      const { ConflictException } = await import('@nestjs/common');
      await expect(service.refreshAccessToken('used-token')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw UnauthorizedException on expired token', async () => {
      userService.atomicRotateRefreshToken.mockRejectedValue(
        new Error('REFRESH_TOKEN_EXPIRED'),
      );

      await expect(service.refreshAccessToken('expired')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when token not found', async () => {
      userService.atomicRotateRefreshToken.mockRejectedValue(
        new Error('REFRESH_TOKEN_NOT_FOUND'),
      );

      await expect(service.refreshAccessToken('invalid')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      userService.atomicRotateRefreshToken.mockRejectedValue(
        new Error('USER_INACTIVE'),
      );

      await expect(service.refreshAccessToken('valid')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should re-throw unexpected errors', async () => {
      const unexpectedError = new Error('DB_CONNECTION_LOST');
      userService.atomicRotateRefreshToken.mockRejectedValue(unexpectedError);

      await expect(service.refreshAccessToken('valid')).rejects.toThrow(
        'DB_CONNECTION_LOST',
      );
    });
  });

  describe('sendEmailVerification', () => {
    it('should save a token and queue the verification email', async () => {
      const userWithEmail = {
        id: 'user-id',
        email: 'user@example.com',
        displayName: 'Alice',
      };
      userService.findById.mockResolvedValue(userWithEmail as any);
      configService.get.mockReturnValue(
        'http://localhost:3000/auth/profile/verify-email',
      );
      emailVerificationRepository.create.mockImplementation(
        (input: any) => input,
      );
      emailVerificationRepository.save.mockImplementation((input: any) =>
        Promise.resolve(input),
      );
      emailService.sendEmail.mockResolvedValue({} as any);

      await service.sendEmailVerification('user-id');

      expect(emailVerificationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-id',
          token: expect.any(String),
        }),
      );
      const savedToken = emailVerificationRepository.save.mock.calls[0][0]
        .token as string;
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.stringContaining('Verify'),
        expect.stringContaining(savedToken),
        expect.stringContaining(savedToken),
      );
    });

    it('should throw if the user has no email set', async () => {
      userService.findById.mockResolvedValue({ id: 'user-id' } as any);

      await expect(service.sendEmailVerification('user-id')).rejects.toThrow(
        BadRequestException,
      );
      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('validateToken', () => {
    it('should return payload if token is valid', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-id',
        walletAddress: 'GD...123',
        type: 'access',
      });

      const result = await service.validateToken('valid-token');

      expect(result).toEqual({
        userId: 'user-id',
        walletAddress: 'GD...123',
      });
    });

    it('should throw if token type is not access', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-id',
        walletAddress: 'GD...123',
        type: 'refresh',
      });

      await expect(service.validateToken('invalid-type')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
