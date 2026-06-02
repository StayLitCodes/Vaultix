import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { EmailVerification } from './entities/email-verification.entity';
import { Repository } from 'typeorm';

describe('UserService', () => {
  let service: UserService;
  let userRepo: jest.Mocked<Repository<User>>;
  let refreshTokenRepo: jest.Mocked<Repository<RefreshToken>>;
  let emailVerificationRepo: jest.Mocked<Repository<EmailVerification>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(EmailVerification),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepo = module.get(getRepositoryToken(User));
    refreshTokenRepo = module.get(getRepositoryToken(RefreshToken));
    emailVerificationRepo = module.get(getRepositoryToken(EmailVerification));
  });

  const mockUser = { id: 'u1', walletAddress: 'GD...123', isActive: true };

  describe('findByWalletAddress', () => {
    it('should call findOne with correct params', async () => {
      userRepo.findOne.mockResolvedValue(mockUser as any);
      const result = await service.findByWalletAddress('GD...123');
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { walletAddress: 'GD...123' },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('findById', () => {
    it('should call findOne with correct params', async () => {
      userRepo.findOne.mockResolvedValue(mockUser as any);
      const result = await service.findById('u1');
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'u1', isActive: true },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('create', () => {
    it('should create and save a user', async () => {
      userRepo.create.mockReturnValue(mockUser as any);
      userRepo.save.mockResolvedValue(mockUser as any);
      const result = await service.create({ walletAddress: 'GD...123' });
      expect(userRepo.create).toHaveBeenCalled();
      expect(userRepo.save).toHaveBeenCalled();
      expect(result).toBe(mockUser);
    });
  });

  describe('update', () => {
    it('should update and return updated user', async () => {
      userRepo.update.mockResolvedValue({} as any);
      userRepo.findOne.mockResolvedValue(mockUser as any);
      const result = await service.update('u1', { isActive: false });
      expect(userRepo.update).toHaveBeenCalledWith('u1', { isActive: false });
      expect(result).toBe(mockUser);
    });

    it('should throw if user not found after update', async () => {
      userRepo.update.mockResolvedValue({} as any);
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.update('u1', {})).rejects.toThrow('User not found');
    });
  });

  describe('refreshToken operations', () => {
    const mockToken = { token: 't1', user: mockUser };

    it('should create and save a refresh token', async () => {
      refreshTokenRepo.create.mockReturnValue(mockToken as any);
      refreshTokenRepo.save.mockResolvedValue(mockToken as any);
      const result = await service.createRefreshToken(mockToken as any);
      expect(result).toBe(mockToken);
    });

    it('should find refresh token', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(mockToken as any);
      const result = await service.findRefreshToken('t1');
      expect(refreshTokenRepo.findOne).toHaveBeenCalledWith({
        where: { token: 't1', isActive: true },
        relations: ['user'],
      });
      expect(result).toBe(mockToken);
    });

    it('should invalidate refresh token', async () => {
      await service.invalidateRefreshToken('t1');
      expect(refreshTokenRepo.update).toHaveBeenCalledWith(
        { token: 't1' },
        { isActive: false },
      );
    });
  });
});
