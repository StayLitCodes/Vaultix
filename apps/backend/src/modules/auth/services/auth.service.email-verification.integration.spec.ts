import { DataSource, Repository } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { UserService } from '../../user/user.service';
import { User } from '../../user/entities/user.entity';
import { RefreshToken } from '../../user/entities/refresh-token.entity';
import { EmailVerification } from '../../user/entities/email-verification.entity';
import { IpfsService } from '../../ipfs/ipfs.service';
import { EmailService } from '../../../email/email.service';
import { EmailTemplatesService } from '../../../email/email-templates.service';
import { PreferenceService } from '../../../notifications/preference.service';

describe('AuthService email verification (address-bound tokens)', () => {
  let dataSource: DataSource;
  let service: AuthService;
  let users: Repository<User>;
  let verifications: Repository<EmailVerification>;

  const ADDRESS_A = 'alice@example.com';
  const ADDRESS_B = 'alice@new.example.com';

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [User, RefreshToken, EmailVerification],
      synchronize: true,
    });
    await dataSource.initialize();
    users = dataSource.getRepository(User);
    verifications = dataSource.getRepository(EmailVerification);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        UserService,
        { provide: getRepositoryToken(User), useValue: users },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: dataSource.getRepository(RefreshToken),
        },
        { provide: DataSource, useValue: dataSource },
        {
          provide: getRepositoryToken(EmailVerification),
          useValue: verifications,
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn(), verifyAsync: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(
              (_key: string, fallback?: string) =>
                fallback ?? 'http://localhost/verify',
            ),
          },
        },
        {
          provide: IpfsService,
          useValue: { uploadFile: jest.fn(), getGatewayUrl: jest.fn() },
        },
        {
          provide: EmailService,
          useValue: { sendEmail: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: EmailTemplatesService,
          useValue: {
            renderVerification: jest.fn(() => ({
              subject: 's',
              html: 'h',
              text: 't',
            })),
          },
        },
        {
          provide: PreferenceService,
          useValue: { seedDefaultPreferences: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  let user: User;

  beforeEach(async () => {
    await verifications.clear();
    await dataSource.getRepository(RefreshToken).clear();
    await users.clear();
    user = await users.save(
      users.create({ walletAddress: 'GTESTWALLET', email: ADDRESS_A }),
    );
  });

  /** Issues a token through the service and returns its value. */
  const issueToken = async (): Promise<string> => {
    const before = new Set(
      (await verifications.find({ where: { userId: user.id } })).map(
        (v) => v.token,
      ),
    );
    await service.sendEmailVerification(user.id);
    const after = await verifications.find({ where: { userId: user.id } });
    return after.find((v) => !before.has(v.token))!.token;
  };

  /**
   * Changes the user's email via updateProfile. The fire-and-forget
   * verification email it triggers is stubbed so it cannot leak into the
   * next test.
   */
  const changeEmail = async (email: string) => {
    const send = jest
      .spyOn(service, 'sendEmailVerification')
      .mockResolvedValue(undefined);
    await service.updateProfile(user.id, { email });
    expect(send).toHaveBeenCalledWith(user.id);
    send.mockRestore();
  };

  const reloadUser = async () => users.findOneByOrFail({ id: user.id });

  it('stores the target address with each token', async () => {
    const token = await issueToken();

    const row = await verifications.findOneByOrFail({ token });
    expect(row.email).toBe(ADDRESS_A);
  });

  it('verifies the current address with a valid token and consumes it', async () => {
    const token = await issueToken();

    await service.verifyEmail(token);

    expect((await reloadUser()).emailVerified).toBe(true);
    expect((await verifications.findOneByOrFail({ token })).isUsed).toBe(true);
  });

  it('rejects a token for address A after the email changes to B', async () => {
    const tokenA = await issueToken();

    await changeEmail(ADDRESS_B);

    await expect(service.verifyEmail(tokenA)).rejects.toThrow(
      BadRequestException,
    );
    const reloaded = await reloadUser();
    expect(reloaded.email).toBe(ADDRESS_B);
    expect(reloaded.emailVerified).toBe(false);
  });

  it('invalidates outstanding tokens when the email changes', async () => {
    const tokenA = await issueToken();

    await changeEmail(ADDRESS_B);

    expect(
      (await verifications.findOneByOrFail({ token: tokenA })).isUsed,
    ).toBe(true);
  });

  it('rejects an A token even if it was never invalidated', async () => {
    const tokenA = await issueToken();
    // Simulate an address change that bypassed updateProfile.
    await users.update(user.id, { email: ADDRESS_B });

    await expect(service.verifyEmail(tokenA)).rejects.toThrow(
      BadRequestException,
    );
    expect((await reloadUser()).emailVerified).toBe(false);
    expect(
      (await verifications.findOneByOrFail({ token: tokenA })).isUsed,
    ).toBe(false);
  });

  it('accepts a valid token issued for the new address B', async () => {
    await issueToken();
    await changeEmail(ADDRESS_B);
    const tokenB = await issueToken();

    await service.verifyEmail(tokenB);

    const reloaded = await reloadUser();
    expect(reloaded.email).toBe(ADDRESS_B);
    expect(reloaded.emailVerified).toBe(true);
  });

  it('rejects an expired token without changing profile state', async () => {
    const token = await issueToken();
    await verifications.update(
      { token },
      { expiresAt: new Date(Date.now() - 1000) },
    );

    await expect(service.verifyEmail(token)).rejects.toThrow(
      BadRequestException,
    );
    expect((await reloadUser()).emailVerified).toBe(false);
  });

  it('rejects an already used token', async () => {
    const token = await issueToken();
    await service.verifyEmail(token);
    await users.update(user.id, { emailVerified: false });

    await expect(service.verifyEmail(token)).rejects.toThrow(
      BadRequestException,
    );
    expect((await reloadUser()).emailVerified).toBe(false);
  });

  it('rejects legacy tokens that are not bound to an address', async () => {
    await verifications.save(
      verifications.create({
        userId: user.id,
        token: 'legacy-token',
        email: null,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    );

    await expect(service.verifyEmail('legacy-token')).rejects.toThrow(
      BadRequestException,
    );
    expect((await reloadUser()).emailVerified).toBe(false);
  });

  it('allows only one of two concurrent verifications to succeed', async () => {
    const token = await issueToken();

    const results = await Promise.allSettled([
      service.verifyEmail(token),
      service.verifyEmail(token),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect((await reloadUser()).emailVerified).toBe(true);
  });

  it('ignores a client-supplied emailVerified flag on profile update', async () => {
    await service.updateProfile(user.id, { emailVerified: true });

    expect((await reloadUser()).emailVerified).toBe(false);
  });
});
