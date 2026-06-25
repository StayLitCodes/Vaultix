import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { EscrowExpirationService } from './escrow-expiration.service';
import { Escrow, EscrowStatus } from '../entities/escrow.entity';
import { EscrowEvent, EscrowEventType } from '../entities/escrow-event.entity';
import { Party, PartyRole } from '../entities/party.entity';
import { EscrowStellarIntegrationService } from './escrow-stellar-integration.service';
import { EscrowGateway } from '../../../gateways/escrow.gateway';
import { NotificationService } from '../../../notifications/notifications.service';
import { NotificationEventType } from '../../../notifications/enums/notification-event.enum';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEscrow(overrides: Partial<Escrow> = {}): Escrow {
  const pastDate = new Date(Date.now() - 60_000); // 1 minute ago
  return {
    id: 'escrow-1',
    title: 'Test Escrow',
    amount: 1000,
    releasedAmount: 0,
    assetCode: 'XLM',
    status: EscrowStatus.ACTIVE,
    isActive: true,
    expiresAt: pastDate,
    parties: [
      { userId: 'buyer-1', role: PartyRole.BUYER, user: { walletAddress: 'GBUY...' } } as any,
      { userId: 'seller-1', role: PartyRole.SELLER, user: { walletAddress: 'GSEL...' } } as any,
    ],
    ...overrides,
  } as Escrow;
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockEscrowRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
});

const mockEscrowEventRepo = () => ({
  save: jest.fn(),
});

const mockPartyRepo = () => ({});

const mockStellarIntegration = () => ({
  refundExpiredOnChain: jest.fn(),
});

const mockGateway = () => ({
  broadcastEscrowRefunded: jest.fn(),
});

const mockNotificationService = () => ({
  handleEscrowEvent: jest.fn(),
});

const mockConfigService = () => ({
  get: jest.fn((key: string, def?: unknown) => {
    if (key === 'PLATFORM_WALLET_PUBLIC_KEY') return 'GPLATFORM...';
    if (key === 'PLATFORM_FEE_BPS') return 100; // 1%
    return def;
  }),
});

const mockDataSource = () => ({
  transaction: jest.fn(async (cb: (manager: any) => Promise<void>) => {
    const manager = {
      update: jest.fn(),
      save: jest.fn(),
    };
    await cb(manager);
    return manager;
  }),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EscrowExpirationService', () => {
  let service: EscrowExpirationService;
  let escrowRepo: ReturnType<typeof mockEscrowRepo>;
  let escrowEventRepo: ReturnType<typeof mockEscrowEventRepo>;
  let stellarIntegration: ReturnType<typeof mockStellarIntegration>;
  let gateway: ReturnType<typeof mockGateway>;
  let notificationService: ReturnType<typeof mockNotificationService>;
  let dataSource: ReturnType<typeof mockDataSource>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowExpirationService,
        { provide: getRepositoryToken(Escrow), useFactory: mockEscrowRepo },
        { provide: getRepositoryToken(EscrowEvent), useFactory: mockEscrowEventRepo },
        { provide: getRepositoryToken(Party), useFactory: mockPartyRepo },
        { provide: EscrowStellarIntegrationService, useFactory: mockStellarIntegration },
        { provide: EscrowGateway, useFactory: mockGateway },
        { provide: NotificationService, useFactory: mockNotificationService },
        { provide: ConfigService, useFactory: mockConfigService },
        { provide: DataSource, useFactory: mockDataSource },
      ],
    }).compile();

    service = module.get(EscrowExpirationService);
    escrowRepo = module.get(getRepositoryToken(Escrow));
    escrowEventRepo = module.get(getRepositoryToken(EscrowEvent));
    stellarIntegration = module.get(EscrowStellarIntegrationService);
    gateway = module.get(EscrowGateway);
    notificationService = module.get(NotificationService);
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // handleEscrowExpirations (cron)
  // -------------------------------------------------------------------------

  describe('handleEscrowExpirations', () => {
    it('should process eligible expired escrows and call refundExpiredOnChain', async () => {
      const escrow = makeEscrow();
      escrowRepo.find.mockResolvedValue([escrow]);
      escrowRepo.findOne.mockResolvedValue(escrow);
      stellarIntegration.refundExpiredOnChain.mockResolvedValue('tx-hash-1');

      await service.handleEscrowExpirations();

      expect(escrowRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: EscrowStatus.ACTIVE }),
        }),
      );
      expect(stellarIntegration.refundExpiredOnChain).toHaveBeenCalledWith(
        escrow.id,
        'GPLATFORM...',
      );
    });

    it('should broadcast escrow.refunded WebSocket event on success', async () => {
      const escrow = makeEscrow();
      escrowRepo.find.mockResolvedValue([escrow]);
      escrowRepo.findOne.mockResolvedValue(escrow);
      stellarIntegration.refundExpiredOnChain.mockResolvedValue('tx-hash-2');

      await service.handleEscrowExpirations();

      expect(gateway.broadcastEscrowRefunded).toHaveBeenCalledWith(
        escrow.id,
        expect.objectContaining({ txHash: 'tx-hash-2' }),
      );
    });

    it('should notify buyer and seller on successful refund', async () => {
      const escrow = makeEscrow();
      escrowRepo.find.mockResolvedValue([escrow]);
      escrowRepo.findOne.mockResolvedValue(escrow);
      stellarIntegration.refundExpiredOnChain.mockResolvedValue('tx-hash-3');

      await service.handleEscrowExpirations();

      expect(notificationService.handleEscrowEvent).toHaveBeenCalledWith(
        'buyer-1',
        NotificationEventType.ESCROW_REFUNDED,
        expect.objectContaining({ escrowId: escrow.id, role: 'buyer' }),
      );
      expect(notificationService.handleEscrowEvent).toHaveBeenCalledWith(
        'seller-1',
        NotificationEventType.ESCROW_REFUNDED,
        expect.objectContaining({ escrowId: escrow.id, role: 'seller' }),
      );
    });

    it('should update escrow status to REFUNDED with tx hash in DB', async () => {
      const escrow = makeEscrow();
      escrowRepo.find.mockResolvedValue([escrow]);
      escrowRepo.findOne.mockResolvedValue(escrow);
      stellarIntegration.refundExpiredOnChain.mockResolvedValue('tx-hash-4');

      await service.handleEscrowExpirations();

      // Verify transaction was called
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('should calculate remaining balance and platform fee correctly', async () => {
      // releasedAmount = 200, amount = 1000 → remaining = 800, fee at 1% = 8, refunded = 792
      const escrow = makeEscrow({ amount: 1000, releasedAmount: 200 });
      escrowRepo.find.mockResolvedValue([escrow]);
      escrowRepo.findOne.mockResolvedValue(escrow);
      stellarIntegration.refundExpiredOnChain.mockResolvedValue('tx-hash-5');

      await service.handleEscrowExpirations();

      expect(gateway.broadcastEscrowRefunded).toHaveBeenCalledWith(
        escrow.id,
        expect.objectContaining({
          refundedAmount: 792,
          platformFee: 8,
          feeBps: 100,
        }),
      );
    });

    it('should skip escrows that are not ACTIVE', async () => {
      const disputedEscrow = makeEscrow({ status: EscrowStatus.DISPUTED });
      escrowRepo.find.mockResolvedValue([]);
      escrowRepo.findOne.mockResolvedValue(disputedEscrow);

      // Even if somehow found, eligibility check should skip it
      await service.handleEscrowExpirations();

      expect(stellarIntegration.refundExpiredOnChain).not.toHaveBeenCalled();
    });

    it('should skip escrows with no remaining balance', async () => {
      const fullyReleasedEscrow = makeEscrow({ amount: 1000, releasedAmount: 1000 });
      escrowRepo.find.mockResolvedValue([fullyReleasedEscrow]);
      escrowRepo.findOne.mockResolvedValue(fullyReleasedEscrow);

      await service.handleEscrowExpirations();

      expect(stellarIntegration.refundExpiredOnChain).not.toHaveBeenCalled();
    });

    it('should skip escrows whose deadline has not passed', async () => {
      const futureEscrow = makeEscrow({
        expiresAt: new Date(Date.now() + 60_000 * 60), // 1 hour in future
      });
      escrowRepo.find.mockResolvedValue([futureEscrow]);
      escrowRepo.findOne.mockResolvedValue(futureEscrow);

      await service.handleEscrowExpirations();

      expect(stellarIntegration.refundExpiredOnChain).not.toHaveBeenCalled();
    });

    it('should not re-run if advisory lock is held', async () => {
      // Simulate the lock being held by starting a concurrent call
      const escrow = makeEscrow();
      escrowRepo.find.mockResolvedValue([escrow]);
      escrowRepo.findOne.mockResolvedValue(escrow);

      // First call: stall in stellarIntegration so lock stays
      let resolveFirst!: (v: string) => void;
      stellarIntegration.refundExpiredOnChain.mockReturnValueOnce(
        new Promise((res) => { resolveFirst = res; }),
      );

      const firstRun = service.handleEscrowExpirations();
      // Second call while first is running — should log and skip
      const secondRun = service.handleEscrowExpirations();

      await secondRun; // should return immediately
      resolveFirst('tx-hash');
      await firstRun;

      expect(escrowRepo.find).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Retry logic
  // -------------------------------------------------------------------------

  describe('retry on Stellar failure', () => {
    it('should retry once on first Stellar failure and succeed on second attempt', async () => {
      const escrow = makeEscrow();
      escrowRepo.find.mockResolvedValue([escrow]);
      escrowRepo.findOne.mockResolvedValue(escrow);

      stellarIntegration.refundExpiredOnChain
        .mockRejectedValueOnce(new Error('Stellar timeout'))
        .mockResolvedValueOnce('tx-retry-success');

      await service.handleEscrowExpirations();

      expect(stellarIntegration.refundExpiredOnChain).toHaveBeenCalledTimes(2);
      expect(gateway.broadcastEscrowRefunded).toHaveBeenCalledWith(
        escrow.id,
        expect.objectContaining({ txHash: 'tx-retry-success' }),
      );
    });

    it('should queue for MANUAL_REFUND if both attempts fail', async () => {
      const escrow = makeEscrow();
      escrowRepo.find.mockResolvedValue([escrow]);
      escrowRepo.findOne.mockResolvedValue(escrow);
      escrowEventRepo.save.mockResolvedValue(undefined);

      stellarIntegration.refundExpiredOnChain
        .mockRejectedValueOnce(new Error('Stellar error 1'))
        .mockRejectedValueOnce(new Error('Stellar error 2'));

      await service.handleEscrowExpirations();

      expect(stellarIntegration.refundExpiredOnChain).toHaveBeenCalledTimes(2);
      expect(gateway.broadcastEscrowRefunded).not.toHaveBeenCalled();

      const queue = service.getManualRefundQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].escrowId).toBe(escrow.id);
      expect(queue[0].lastError).toBe('Stellar error 2');
    });

    it('should emit QUEUED_MANUAL_REFUND event and notify buyer of failure', async () => {
      const escrow = makeEscrow();
      escrowRepo.find.mockResolvedValue([escrow]);
      escrowRepo.findOne.mockResolvedValue(escrow);
      escrowEventRepo.save.mockResolvedValue(undefined);

      stellarIntegration.refundExpiredOnChain
        .mockRejectedValue(new Error('Persistent error'));

      await service.handleEscrowExpirations();

      expect(escrowEventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: EscrowEventType.QUEUED_MANUAL_REFUND }),
      );
      expect(notificationService.handleEscrowEvent).toHaveBeenCalledWith(
        'buyer-1',
        NotificationEventType.ESCROW_REFUND_FAILED,
        expect.objectContaining({ escrowId: escrow.id }),
      );
    });

    it('should not add same escrow to MANUAL_REFUND queue twice', async () => {
      const escrow = makeEscrow();
      escrowRepo.find.mockResolvedValue([escrow]);
      escrowRepo.findOne.mockResolvedValue(escrow);
      escrowEventRepo.save.mockResolvedValue(undefined);
      stellarIntegration.refundExpiredOnChain.mockRejectedValue(new Error('fail'));

      // Run twice
      await service.handleEscrowExpirations();
      await service.handleEscrowExpirations();

      const queue = service.getManualRefundQueue();
      expect(queue.filter((q) => q.escrowId === escrow.id)).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // processRefundManually
  // -------------------------------------------------------------------------

  describe('processRefundManually', () => {
    it('should successfully process a valid escrow manually', async () => {
      const escrow = makeEscrow();
      escrowRepo.findOne
        .mockResolvedValueOnce(escrow) // initial lookup
        .mockResolvedValueOnce(escrow); // re-fetch inside retry logic
      stellarIntegration.refundExpiredOnChain.mockResolvedValue('manual-tx');

      await service.processRefundManually(escrow.id);

      expect(stellarIntegration.refundExpiredOnChain).toHaveBeenCalledWith(
        escrow.id,
        'GPLATFORM...',
      );
    });

    it('should throw if escrow not found', async () => {
      escrowRepo.findOne.mockResolvedValue(null);

      await expect(service.processRefundManually('no-such-id')).rejects.toThrow(
        'Escrow no-such-id not found',
      );
    });

    it('should throw if escrow not eligible', async () => {
      const completedEscrow = makeEscrow({ status: EscrowStatus.COMPLETED });
      escrowRepo.findOne.mockResolvedValue(completedEscrow);

      await expect(service.processRefundManually(completedEscrow.id)).rejects.toThrow(
        /not eligible/,
      );
    });
  });

  // -------------------------------------------------------------------------
  // MANUAL_REFUND queue helpers
  // -------------------------------------------------------------------------

  describe('manualRefundQueue helpers', () => {
    it('getManualRefundQueue should return a copy of the queue', async () => {
      const escrow = makeEscrow();
      escrowRepo.find.mockResolvedValue([escrow]);
      escrowRepo.findOne.mockResolvedValue(escrow);
      escrowEventRepo.save.mockResolvedValue(undefined);
      stellarIntegration.refundExpiredOnChain.mockRejectedValue(new Error('fail'));

      await service.handleEscrowExpirations();

      const queue = service.getManualRefundQueue();
      expect(queue).toHaveLength(1);
      // Modifying the returned array should NOT affect the internal queue
      queue.splice(0, 1);
      expect(service.getManualRefundQueue()).toHaveLength(1);
    });

    it('removeFromManualRefundQueue should remove by escrowId', async () => {
      const escrow = makeEscrow();
      escrowRepo.find.mockResolvedValue([escrow]);
      escrowRepo.findOne.mockResolvedValue(escrow);
      escrowEventRepo.save.mockResolvedValue(undefined);
      stellarIntegration.refundExpiredOnChain.mockRejectedValue(new Error('fail'));

      await service.handleEscrowExpirations();
      expect(service.getManualRefundQueue()).toHaveLength(1);

      const removed = service.removeFromManualRefundQueue(escrow.id);
      expect(removed).toBe(true);
      expect(service.getManualRefundQueue()).toHaveLength(0);
    });

    it('removeFromManualRefundQueue should return false for unknown id', () => {
      const removed = service.removeFromManualRefundQueue('unknown-id');
      expect(removed).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Platform fee calculation edge cases
  // -------------------------------------------------------------------------

  describe('fee calculation', () => {
    it('should handle zero fee BPS (no fee deduction)', async () => {
      const configGet = jest.fn((key: string, def?: unknown) => {
        if (key === 'PLATFORM_WALLET_PUBLIC_KEY') return 'GPLATFORM...';
        if (key === 'PLATFORM_FEE_BPS') return 0;
        return def;
      });
      // Override config service mock for this test
      (service as any).configService = { get: configGet };

      const escrow = makeEscrow({ amount: 1000, releasedAmount: 0 });
      escrowRepo.find.mockResolvedValue([escrow]);
      escrowRepo.findOne.mockResolvedValue(escrow);
      stellarIntegration.refundExpiredOnChain.mockResolvedValue('tx-zero-fee');

      await service.handleEscrowExpirations();

      expect(gateway.broadcastEscrowRefunded).toHaveBeenCalledWith(
        escrow.id,
        expect.objectContaining({
          refundedAmount: 1000,
          platformFee: 0,
        }),
      );
    });

    it('should handle large BPS fee (500 BPS = 5%)', async () => {
      (service as any).configService = {
        get: jest.fn((key: string, def?: unknown) => {
          if (key === 'PLATFORM_WALLET_PUBLIC_KEY') return 'GPLATFORM...';
          if (key === 'PLATFORM_FEE_BPS') return 500;
          return def;
        }),
      };

      const escrow = makeEscrow({ amount: 2000, releasedAmount: 0 });
      escrowRepo.find.mockResolvedValue([escrow]);
      escrowRepo.findOne.mockResolvedValue(escrow);
      stellarIntegration.refundExpiredOnChain.mockResolvedValue('tx-large-fee');

      await service.handleEscrowExpirations();

      expect(gateway.broadcastEscrowRefunded).toHaveBeenCalledWith(
        escrow.id,
        expect.objectContaining({
          refundedAmount: 1900, // 2000 - 5% = 1900
          platformFee: 100,
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Multiple escrows
  // -------------------------------------------------------------------------

  describe('multiple escrows', () => {
    it('should process multiple expired escrows independently', async () => {
      const escrow1 = makeEscrow({ id: 'esc-a' });
      const escrow2 = makeEscrow({ id: 'esc-b' });

      escrowRepo.find.mockResolvedValue([escrow1, escrow2]);
      escrowRepo.findOne
        .mockResolvedValueOnce(escrow1)
        .mockResolvedValueOnce(escrow2);
      stellarIntegration.refundExpiredOnChain
        .mockResolvedValueOnce('tx-a')
        .mockResolvedValueOnce('tx-b');

      await service.handleEscrowExpirations();

      expect(stellarIntegration.refundExpiredOnChain).toHaveBeenCalledTimes(2);
      expect(gateway.broadcastEscrowRefunded).toHaveBeenCalledTimes(2);
    });

    it('should continue processing remaining escrows if one fails', async () => {
      const escrow1 = makeEscrow({ id: 'esc-fail' });
      const escrow2 = makeEscrow({ id: 'esc-ok' });

      escrowRepo.find.mockResolvedValue([escrow1, escrow2]);
      escrowEventRepo.save.mockResolvedValue(undefined);

      escrowRepo.findOne
        .mockResolvedValueOnce(escrow1)
        .mockResolvedValueOnce(escrow2);

      stellarIntegration.refundExpiredOnChain
        .mockRejectedValueOnce(new Error('fail-1a'))
        .mockRejectedValueOnce(new Error('fail-1b'))
        .mockResolvedValueOnce('tx-ok');

      await service.handleEscrowExpirations();

      // escrow-fail queued, escrow-ok refunded
      expect(gateway.broadcastEscrowRefunded).toHaveBeenCalledWith(
        'esc-ok',
        expect.any(Object),
      );
      expect(service.getManualRefundQueue().map((q) => q.escrowId)).toContain('esc-fail');
    });
  });
});
