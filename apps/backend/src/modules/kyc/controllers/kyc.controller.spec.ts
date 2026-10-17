import { Test, TestingModule } from '@nestjs/testing';
import { KycController } from './kyc.controller';
import { KycService } from '../services/kyc.service';
import { KycStatus } from '../entities/kyc-verification.entity';
import { AuthGuard } from '../../auth/middleware/auth.guard';
import { CanActivate } from '@nestjs/common';

describe('KycController', () => {
  let controller: KycController;
  let kycService: jest.Mocked<Partial<KycService>>;

  const mockUser = { userId: 'user-1' };
  const mockRequest = { user: mockUser } as any;

  beforeEach(async () => {
    const mockKycService = {
      getKycStatus: jest.fn(),
      initiateVerification: jest.fn(),
    };

    const mockAuthGuard: CanActivate = {
      canActivate: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [KycController],
      providers: [
        {
          provide: KycService,
          useValue: mockKycService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<KycController>(KycController);
    kycService = module.get(KycService);
  });

  describe('getStatus', () => {
    it('should return KYC status for authenticated user', async () => {
      const statusResponse = {
        status: KycStatus.VERIFIED,
        provider: 'mock',
        initiatedAt: new Date(),
        completedAt: new Date(),
      };
      kycService.getKycStatus.mockResolvedValue(statusResponse);

      const result = await controller.getStatus(mockRequest);

      expect(result).toEqual(statusResponse);
      expect(kycService.getKycStatus).toHaveBeenCalledWith('user-1');
    });
  });

  describe('initiateVerification', () => {
    it('should initiate verification and return redirect URL', async () => {
      const initResponse = {
        verificationId: 'mock-verification-123',
        redirectUrl: 'https://mock-kyc.example.com/verify',
        expiresAt: new Date(),
      };
      kycService.initiateVerification.mockResolvedValue(initResponse);

      const dto = {};
      const result = await controller.initiateVerification(mockRequest, dto);

      expect(result).toEqual(initResponse);
      expect(kycService.initiateVerification).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
    });
  });
});
