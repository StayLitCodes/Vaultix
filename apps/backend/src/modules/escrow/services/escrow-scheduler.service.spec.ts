import { Test, TestingModule } from '@nestjs/testing';
import { EscrowSchedulerService } from './escrow-scheduler.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Escrow, EscrowStatus } from '../entities/escrow.entity';
import { EscrowEvent } from '../entities/escrow-event.entity';
import { EscrowService } from './escrow.service';
import { Repository } from 'typeorm';

describe('EscrowSchedulerService', () => {
  let service: EscrowSchedulerService;
  let escrowRepo: jest.Mocked<Repository<Escrow>>;
  let eventRepo: jest.Mocked<Repository<EscrowEvent>>;
  let escrowService: jest.Mocked<EscrowService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowSchedulerService,
        {
          provide: getRepositoryToken(Escrow),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(EscrowEvent),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: EscrowService,
          useValue: {
            expireBySystem: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EscrowSchedulerService>(EscrowSchedulerService);
    escrowRepo = module.get(getRepositoryToken(Escrow));
    eventRepo = module.get(getRepositoryToken(EscrowEvent));
    escrowService = module.get(EscrowService);
  });

  const mockEscrow = {
    id: 'e1',
    status: EscrowStatus.PENDING,
    expiresAt: new Date(Date.now() - 1000),
    isActive: true,
    title: 'Test Escrow',
    parties: [{ user: { walletAddress: 'addr1' } }],
  };

  describe('handleExpiredEscrows', () => {
    it('should process expired pending and active escrows', async () => {
      escrowRepo.find.mockResolvedValueOnce([mockEscrow] as any); // pending
      escrowRepo.find.mockResolvedValueOnce([
        { ...mockEscrow, status: EscrowStatus.ACTIVE },
      ] as any); // active
      escrowService.expireBySystem.mockResolvedValue({
        ...mockEscrow,
        status: EscrowStatus.EXPIRED,
      } as any);

      await service.handleExpiredEscrows();

      expect(escrowService.expireBySystem).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendExpirationWarnings', () => {
    it('should process escrows needing warnings', async () => {
      escrowRepo.find.mockResolvedValue([
        {
          ...mockEscrow,
          status: EscrowStatus.ACTIVE,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        },
      ] as any);

      await service.sendExpirationWarnings();

      expect(escrowRepo.save).toHaveBeenCalled();
      expect(eventRepo.save).toHaveBeenCalled();
    });
  });

  describe('processEscrowManually', () => {
    it('should throw if escrow not found', async () => {
      escrowRepo.findOne.mockResolvedValue(null);
      await expect(service.processEscrowManually('e1')).rejects.toThrow(
        'Escrow not found',
      );
    });

    it('should throw if not expired', async () => {
      escrowRepo.findOne.mockResolvedValue({
        ...mockEscrow,
        expiresAt: new Date(Date.now() + 100000),
      } as any);
      await expect(service.processEscrowManually('e1')).rejects.toThrow(
        'has not expired yet',
      );
    });

    it('should auto-cancel if pending', async () => {
      escrowRepo.findOne.mockResolvedValue(mockEscrow as any);
      escrowService.expireBySystem.mockResolvedValue(mockEscrow as any);
      await service.processEscrowManually('e1');
      expect(escrowService.expireBySystem).toHaveBeenCalledWith(
        'e1',
        'EXPIRED_PENDING',
      );
    });
  });
});
