import { DataSource } from 'typeorm';
import { Keypair } from '@stellar/stellar-sdk';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
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

describe('AuthService wallet challenge (real Stellar signatures)', () => {
  let dataSource: DataSource;
  let service: AuthService;
  let userService: UserService;
  let keypair: Keypair;

  const buildMessage = (nonce: string): string =>
    `Sign this message to authenticate with Vaultix: ${nonce}`;

  beforeAll(async () => {
    keypair = Keypair.random();
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [User, RefreshToken, EmailVerification],
      synchronize: true,
    });
    await dataSource.initialize();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: dataSource.getRepository(User),
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: dataSource.getRepository(RefreshToken),
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: getRepositoryToken(EmailVerification),
          useValue: { create: jest.fn(), save: jest.fn(), findOne: jest.fn() },
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
          useValue: { get: jest.fn().mockReturnValue('jwt-secret') },
        },
        {
          provide: IpfsService,
          useValue: { uploadFile: jest.fn(), getGatewayUrl: jest.fn() },
        },
        {
          provide: EmailService,
          useValue: { sendEmail: jest.fn() },
        },
        {
          provide: EmailTemplatesService,
          useValue: { renderVerification: jest.fn() },
        },
        {
          provide: PreferenceService,
          useValue: { seedDefaultPreferences: jest.fn().mockResolvedValue([]) },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    // Clear dependent refresh tokens before their parent users (FK constraint).
    await dataSource.getRepository(RefreshToken).clear();
    await dataSource.getRepository(User).clear();
  });

  const issueChallenge = async () => {
    const { nonce, message } = await service.generateChallenge(
      keypair.publicKey(),
    );
    const signature = keypair.sign(Buffer.from(message)).toString('hex');
    return { nonce, signature };
  };

  it('accepts a valid, unexpired, real signature once', async () => {
    const { nonce, signature } = await issueChallenge();

    const result = await service.verifySignature(
      signature,
      keypair.publicKey(),
    );

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(nonce).toEqual(expect.any(String));
  });

  it('rejects a replayed signature', async () => {
    const { signature } = await issueChallenge();

    await service.verifySignature(signature, keypair.publicKey());
    await expect(
      service.verifySignature(signature, keypair.publicKey()),
    ).rejects.toThrow('Invalid challenge');
  });

  it('rejects a signature made over a superseded (replaced) challenge', async () => {
    const first = await issueChallenge();
    // Issuing a new challenge supersedes the first: the stored nonce changes,
    // so the previously signed message no longer verifies (and would not match
    // the exact-nonce consume either).
    await issueChallenge();

    await expect(
      service.verifySignature(first.signature, keypair.publicKey()),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an expired challenge even with a valid signature', async () => {
    const { nonce, message } = await service.generateChallenge(
      keypair.publicKey(),
    );
    const signature = keypair.sign(Buffer.from(message)).toString('hex');

    // Force the stored expiry into the past.
    await dataSource
      .getRepository(User)
      .createQueryBuilder()
      .update(User)
      .set({ nonceExpiresAt: new Date(Date.now() - 1000) })
      .where('nonce = :nonce', { nonce })
      .execute();

    await expect(
      service.verifySignature(signature, keypair.publicKey()),
    ).rejects.toThrow('Challenge expired');
  });

  it('rejects an inactive user even with a valid signature', async () => {
    const { signature } = await issueChallenge();

    await dataSource
      .getRepository(User)
      .createQueryBuilder()
      .update(User)
      .set({ isActive: false })
      .execute();

    await expect(
      service.verifySignature(signature, keypair.publicKey()),
    ).rejects.toThrow('Account is not active');
  });

  it('allows only one of two concurrent verifications to succeed', async () => {
    const { signature } = await issueChallenge();

    const results = await Promise.allSettled([
      service.verifySignature(signature, keypair.publicKey()),
      service.verifySignature(signature, keypair.publicKey()),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  it('rejects a signature from a different key', async () => {
    const { message } = await service.generateChallenge(keypair.publicKey());
    const otherKey = Keypair.random();
    const foreignSignature = otherKey
      .sign(Buffer.from(message))
      .toString('hex');

    await expect(
      service.verifySignature(foreignSignature, keypair.publicKey()),
    ).rejects.toThrow();
  });

  it('exposes a 5-minute challenge lifetime in the stored expiry', async () => {
    await service.generateChallenge(keypair.publicKey());
    const row = await dataSource
      .getRepository(User)
      .findOneByOrFail({ walletAddress: keypair.publicKey() });
    expect(row.nonceExpiresAt).toBeInstanceOf(Date);
    const ttl = (row.nonceExpiresAt as Date).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(4 * 60 * 1000);
    expect(ttl).toBeLessThanOrEqual(5 * 60 * 1000);
  });
});
