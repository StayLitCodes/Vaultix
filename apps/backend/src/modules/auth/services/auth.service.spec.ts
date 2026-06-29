import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmailVerification } from '../../user/entities/email-verification.entity';
import { IpfsService } from '../../ipfs/ipfs.service';

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

  const mockUser = {
    id: 'user-id',
    walletAddress: 'GD...123',
    nonce: 'test-nonce',
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
            findRefreshToken: jest.fn(),
            invalidateRefreshToken: jest.fn(),
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
      });
    });

    it('should update nonce if user exists', async () => {
      userService.findByWalletAddress.mockResolvedValue(mockUser as any);
      userService.update.mockResolvedValue(mockUser as any);

      const result = await service.generateChallenge('GD...123');

      expect(result).toHaveProperty('nonce');
      expect(userService.update).toHaveBeenCalledWith(mockUser.id, {
        nonce: expect.any(String),
      });
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
      userService.update.mockResolvedValue(mockUser as any);
      userService.createRefreshToken.mockResolvedValue({} as any);

      const result = await service.verifySignature('sig', 'GD...123');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(userService.update).toHaveBeenCalledWith(mockUser.id, {
        nonce: undefined,
      });
    });
  });

  describe('refreshAccessToken', () => {
    it('should throw if token invalid or expired', async () => {
      userService.findRefreshToken.mockResolvedValue(null);
      await expect(service.refreshAccessToken('invalid')).rejects.toThrow(
        UnauthorizedException,
      );

      userService.findRefreshToken.mockResolvedValue({
        ...mockRefreshToken,
        expiresAt: new Date(0),
      } as any);
      await expect(service.refreshAccessToken('expired')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return new tokens', async () => {
      userService.findRefreshToken.mockResolvedValue(mockRefreshToken as any);
      userService.createRefreshToken.mockResolvedValue({} as any);

      const result = await service.refreshAccessToken('refresh-token');

      expect(result.accessToken).toBe('access-token');
      expect(userService.invalidateRefreshToken).toHaveBeenCalledWith(
        'refresh-token',
      );
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
