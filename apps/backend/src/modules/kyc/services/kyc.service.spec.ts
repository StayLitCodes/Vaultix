import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { KycService } from './kyc.service';
import {
  KycVerification,
  KycStatus,
  KycProvider,
} from '../entities/kyc-verification.entity';
import { User } from '../../user/entities/user.entity';
import { MockKycProvider } from '../providers/mock-kyc.provider';
import { InitiateKycDto } from '../dto/kyc.dto';

describe('KycService', () => {
  let service: KycService;
  let kycVerificationRepo: jest.Mocked<Repository<KycVerification>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let mockProvider: MockKycProvider;    const mockUser: Partial<User> = {
      id: 'user-1',
      walletAddress: 'GABCDEF1234567890',
      isActive: true,
      kycStatus: KycStatus.NOT_STARTED,
    };

  beforeEach(async () => {
    const mockKycVerificationRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
    };

    const mockUserRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      findAndCount: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'KYC_DEFAULT_PROVIDER') return 'mock';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycService,
        MockKycProvider,
        {
          provide: getRepositoryToken(KycVerification),
          useValue: mockKycVerificationRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<KycService>(KycService);
    kycVerificationRepo = module.get(getRepositoryToken(KycVerification));
    userRepo = module.get(getRepositoryToken(User));
    mockProvider = module.get<MockKycProvider>(MockKycProvider);
  });

  describe('initiateVerification', () => {
    it('should initiate a new KYC verification', async () => {
      userRepo.findOne.mockResolvedValue(mockUser as User);
      kycVerificationRepo.findOne.mockResolvedValue(null);
      kycVerificationRepo.create.mockReturnValue({
        userId: mockUser.id,
        provider: KycProvider.MOCK,
        status: KycStatus.PENDING,
      } as KycVerification);
      kycVerificationRepo.save.mockResolvedValue({
        id: 'kyc-1',
        userId: mockUser.id,
        provider: KycProvider.MOCK,
        status: KycStatus.PENDING,
        providerVerificationId: 'mock-kyc-123',
      } as KycVerification);

      const dto: InitiateKycDto = {};
      const result = await service.initiateVerification('user-1', dto);

      expect(result.verificationId).toBeDefined();
      expect(result.redirectUrl).toBeDefined();
      expect(kycVerificationRepo.save).toHaveBeenCalled();
      expect(userRepo.save).toHaveBeenCalled();
    });

    it('should throw if user is already verified', async () => {
      const verifiedUser = { ...mockUser, kycStatus: KycStatus.VERIFIED };
      userRepo.findOne.mockResolvedValue(verifiedUser as User);

      const dto: InitiateKycDto = {};
      await expect(
        service.initiateVerification('user-1', dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      const dto: InitiateKycDto = {};
      await expect(
        service.initiateVerification('non-existent', dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return existing pending verification', async () => {
      userRepo.findOne.mockResolvedValue({
        ...mockUser,
        kycStatus: KycStatus.PENDING,
      } as User);
      kycVerificationRepo.findOne.mockResolvedValue({
        id: 'existing-kyc',
        userId: 'user-1',
        status: KycStatus.PENDING,
        providerVerificationId: 'existing-provider-id',
      } as KycVerification);

      const dto: InitiateKycDto = {};
      const result = await service.initiateVerification('user-1', dto);

      expect(result.verificationId).toBe('existing-provider-id');
    });
  });

  describe('getKycStatus', () => {
    it('should return KYC status for a user', async () => {
      userRepo.findOne.mockResolvedValue({
        ...mockUser,
        kycStatus: KycStatus.VERIFIED as any,
      } as User);
      kycVerificationRepo.findOne.mockResolvedValue({
        userId: 'user-1',
        provider: 'mock',
        status: KycStatus.VERIFIED,
        initiatedAt: new Date(),
        completedAt: new Date(),
      } as KycVerification);

      const result = await service.getKycStatus('user-1');

      expect(result.status).toBe(KycStatus.VERIFIED);
      expect(result.provider).toBe('mock');
    });

    it('should throw if user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getKycStatus('non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('isKycVerified', () => {
    it('should return true for verified users', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        kycStatus: KycStatus.VERIFIED,
      } as User);

      const result = await service.isKycVerified('user-1');
      expect(result).toBe(true);
    });

    it('should return false for unverified users', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-2',
        kycStatus: KycStatus.NOT_STARTED,
      } as User);

      const result = await service.isKycVerified('user-2');
      expect(result).toBe(false);
    });
  });

  describe('getAdminKycList', () => {
    it('should return paginated list of users with KYC status', async () => {
      const users = [mockUser as User];
      userRepo.findAndCount.mockResolvedValue([users, 1]);

      const result = await service.getAdminKycList();

      expect(result.users).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should filter by KYC status', async () => {
      userRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.getAdminKycList('verified');

      expect(result.users).toHaveLength(0);
      expect(userRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ kycStatus: 'verified' }),
        }),
      );
    });
  });
});
