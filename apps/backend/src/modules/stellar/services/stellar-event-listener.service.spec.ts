import { Test, TestingModule } from '@nestjs/testing';
import { StellarEventListenerService } from './stellar-event-listener.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  StellarEvent,
  StellarEventType,
} from '../entities/stellar-event.entity';
import { Escrow, EscrowStatus } from '../../escrow/entities/escrow.entity';
import { Condition } from '../../escrow/entities/condition.entity';
import {
  EscrowEvent,
  EscrowEventType,
} from '../../escrow/entities/escrow-event.entity';
import { Party, PartyRole } from '../../escrow/entities/party.entity';
import { SorobanClientService } from '../../../services/stellar/soroban-client.service';
import { ConfigService } from '@nestjs/config';
import { ConsistencyCheckerService } from '../../admin/services/consistency-checker.service';
import { EscrowGateway } from '../../../gateways/escrow.gateway';
import { NotificationService } from '../../../notifications/notifications.service';

describe('StellarEventListenerService', () => {
  let service: StellarEventListenerService;
  let stellarEventRepo: jest.Mocked<any>;
  let escrowRepo: jest.Mocked<any>;
  let conditionRepo: jest.Mocked<any>;
  let escrowEventRepo: jest.Mocked<any>;
  let partyRepo: jest.Mocked<any>;
  let sorobanClient: jest.Mocked<any>;
  let rpcServer: jest.Mocked<any>;
  let escrowGateway: jest.Mocked<any>;
  let notificationService: jest.Mocked<any>;

  beforeEach(async () => {
    rpcServer = {
      getLatestLedger: jest.fn().mockResolvedValue({ sequence: 100 }),
      getEvents: jest.fn().mockResolvedValue({ events: [] }),
    };

    escrowGateway = {
      broadcastMilestoneReleased: jest.fn(),
    };

    notificationService = {
      handleEscrowEvent: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarEventListenerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(0),
          },
        },
        {
          provide: getRepositoryToken(StellarEvent),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn().mockImplementation((dto) => dto),
          },
        },
        {
          provide: getRepositoryToken(Escrow),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn().mockImplementation((dto) => dto),
          },
        },
        {
          provide: getRepositoryToken(Condition),
          useValue: {
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(EscrowEvent),
          useValue: {
            create: jest.fn().mockImplementation((dto) => dto),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Party),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: SorobanClientService,
          useValue: {
            getContractId: jest.fn().mockReturnValue('contract-id'),
            getRpc: jest.fn().mockReturnValue(rpcServer),
          },
        },
        {
          provide: ConsistencyCheckerService,
          useValue: {
            checkConsistency: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: EscrowGateway,
          useValue: escrowGateway,
        },
        {
          provide: NotificationService,
          useValue: notificationService,
        },
      ],
    }).compile();

    service = module.get<StellarEventListenerService>(
      StellarEventListenerService,
    );
    stellarEventRepo = module.get(getRepositoryToken(StellarEvent));
    escrowRepo = module.get(getRepositoryToken(Escrow));
    conditionRepo = module.get(getRepositoryToken(Condition));
    escrowEventRepo = module.get(getRepositoryToken(EscrowEvent));
    partyRepo = module.get(getRepositoryToken(Party));
    sorobanClient = module.get(SorobanClientService);

    // Mock sleep and pollEvents to avoid waiting and infinite loop
    (service as any).sleep = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(service as any, 'pollEvents').mockResolvedValue(undefined);

    // Initialize server and contractId
    (service as any).server = rpcServer;
    (service as any).contractId = 'contract-id';
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize and start listener', async () => {
      const startSpy = jest
        .spyOn(service, 'startEventListener')
        .mockResolvedValue();
      await service.onModuleInit();
      expect(sorobanClient.getContractId).toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalled();
    });
  });

  describe('startEventListener', () => {
    it('should set isRunning to true and poll events', async () => {
      // Mock pollEvents to avoid infinite loop
      const pollSpy = jest
        .spyOn(service as any, 'pollEvents')
        .mockResolvedValue(undefined);
      await service.startEventListener();
      expect(service.getSyncStatus().isRunning).toBe(true);
      expect(pollSpy).toHaveBeenCalled();
    });
  });

  describe('processNewEvents', () => {
    it('should not process if no new ledgers', async () => {
      (service as any).lastProcessedLedger = 100;
      rpcServer.getLatestLedger.mockResolvedValue({ sequence: 100 });
      await (service as any).processNewEvents();
      expect(rpcServer.getEvents).not.toHaveBeenCalled();
    });

    it('should process new ledgers if available', async () => {
      (service as any).lastProcessedLedger = 90;
      rpcServer.getLatestLedger.mockResolvedValue({ sequence: 100 });
      rpcServer.getEvents.mockResolvedValue({ events: [] });
      await (service as any).processNewEvents();
      expect(rpcServer.getEvents).toHaveBeenCalled();
      expect((service as any).lastProcessedLedger).toBe(100);
    });
  });

  describe('handleEscrowFunded', () => {
    it('should update status to ACTIVE', async () => {
      const mockEscrow = { id: 'e1', status: EscrowStatus.PENDING };
      escrowRepo.findOne.mockResolvedValue(mockEscrow);

      const event = {
        escrowId: 'e1',
        eventType: StellarEventType.ESCROW_FUNDED,
      } as any;
      await (service as any).handleEscrowFunded(event);

      expect(mockEscrow.status).toBe(EscrowStatus.ACTIVE);
      expect(escrowRepo.save).toHaveBeenCalledWith(mockEscrow);
    });
  });

  describe('handleMilestoneReleased', () => {
    const baseConditions = [
      {
        id: 'cond-0',
        escrowId: 'escrow-1',
        description: 'Milestone 1',
        isReleased: false,
        releasedAt: null,
        amount: 100,
        metadata: {},
        createdAt: new Date('2025-01-01'),
      },
      {
        id: 'cond-1',
        escrowId: 'escrow-1',
        description: 'Milestone 2',
        isReleased: false,
        releasedAt: null,
        amount: 200,
        metadata: {},
        createdAt: new Date('2025-01-02'),
      },
    ];

    const baseEscrow = {
      id: 'escrow-1',
      title: 'Test Escrow',
      amount: 300,
      releasedAmount: 0,
      status: EscrowStatus.ACTIVE,
      conditions: baseConditions,
    };

    const mockEvent = {
      id: 'stellar-event-1',
      escrowId: 'escrow-1',
      eventType: StellarEventType.MILESTONE_RELEASED,
      milestoneIndex: 0,
      amount: 100,
      txHash: 'tx-abc-123',
      ledger: 42,
      timestamp: new Date('2025-06-15'),
    } as any;

    it('should mark condition as released and update escrow releasedAmount', async () => {
      escrowRepo.findOne.mockResolvedValue({
        ...baseEscrow,
        conditions: [...baseConditions.map((c) => ({ ...c }))],
      });
      partyRepo.find.mockResolvedValue([]);

      await (service as any).handleMilestoneReleased(mockEvent);

      // Condition should be marked released
      expect(conditionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'cond-0',
          isReleased: true,
          releasedAt: mockEvent.timestamp,
          metadata: expect.objectContaining({
            releasedTxHash: 'tx-abc-123',
            milestoneIndex: 0,
          }),
        }),
      );

      // Escrow releasedAmount should be updated
      expect(escrowRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'escrow-1',
          releasedAmount: 100,
          stellarTxHash: 'tx-abc-123',
        }),
      );
    });

    it('should create an audit trail entry in escrow_events', async () => {
      escrowRepo.findOne.mockResolvedValue({
        ...baseEscrow,
        conditions: [...baseConditions.map((c) => ({ ...c }))],
      });
      partyRepo.find.mockResolvedValue([]);

      await (service as any).handleMilestoneReleased(mockEvent);

      expect(escrowEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          escrowId: 'escrow-1',
          eventType: EscrowEventType.MILESTONE_RELEASED,
          actorId: 'stellar-network',
          data: expect.objectContaining({
            milestoneIndex: 0,
            amount: 100,
            conditionId: 'cond-0',
            txHash: 'tx-abc-123',
          }),
        }),
      );
      expect(escrowEventRepo.save).toHaveBeenCalled();
    });

    it('should emit WebSocket event via EscrowGateway', async () => {
      escrowRepo.findOne.mockResolvedValue({
        ...baseEscrow,
        conditions: [...baseConditions.map((c) => ({ ...c }))],
      });
      partyRepo.find.mockResolvedValue([]);

      await (service as any).handleMilestoneReleased(mockEvent);

      expect(escrowGateway.broadcastMilestoneReleased).toHaveBeenCalledWith(
        'escrow-1',
        expect.objectContaining({
          milestoneIndex: 0,
          amount: 100,
          conditionId: 'cond-0',
          txHash: 'tx-abc-123',
        }),
      );
    });

    it('should not create notifications for a milestone event', async () => {
      escrowRepo.findOne.mockResolvedValue({
        ...baseEscrow,
        conditions: [...baseConditions.map((c) => ({ ...c }))],
      });
      await (service as any).handleMilestoneReleased(mockEvent);

      expect(notificationService.handleEscrowEvent).not.toHaveBeenCalled();
    });

    it('should be idempotent — skip if milestone already released', async () => {
      const alreadyReleased = {
        ...baseEscrow,
        conditions: [
          { ...baseConditions[0], isReleased: true },
          { ...baseConditions[1] },
        ],
      };
      escrowRepo.findOne.mockResolvedValue(alreadyReleased);

      await (service as any).handleMilestoneReleased(mockEvent);

      // Should NOT save condition or escrow changes
      expect(conditionRepo.save).not.toHaveBeenCalled();
      expect(escrowRepo.save).not.toHaveBeenCalled();
      expect(escrowEventRepo.save).not.toHaveBeenCalled();
    });

    it('should log warning and return if escrow not found', async () => {
      escrowRepo.findOne.mockResolvedValue(null);
      const warnSpy = jest.spyOn((service as any).logger, 'warn');

      await (service as any).handleMilestoneReleased(mockEvent);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Escrow not found in DB'),
      );
      expect(conditionRepo.save).not.toHaveBeenCalled();
      expect(escrowRepo.save).not.toHaveBeenCalled();
    });

    it('should log warning if escrowId is missing', async () => {
      const eventWithoutEscrow = { ...mockEvent, escrowId: undefined };
      const warnSpy = jest.spyOn((service as any).logger, 'warn');

      await (service as any).handleMilestoneReleased(eventWithoutEscrow);

      expect(warnSpy).toHaveBeenCalledWith(
        'Milestone released event missing escrowId',
      );
    });

    it('should handle the second milestone index correctly', async () => {
      const event2 = { ...mockEvent, milestoneIndex: 1, amount: 200 };
      escrowRepo.findOne.mockResolvedValue({
        ...baseEscrow,
        conditions: [...baseConditions.map((c) => ({ ...c }))],
      });
      partyRepo.find.mockResolvedValue([]);

      await (service as any).handleMilestoneReleased(event2);

      expect(conditionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'cond-1',
          isReleased: true,
        }),
      );
      expect(escrowRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          releasedAmount: 200,
        }),
      );
    });

    it('should accumulate releasedAmount across multiple milestones', async () => {
      // First milestone already released
      const escrowWithFirstReleased = {
        ...baseEscrow,
        releasedAmount: 100,
        conditions: [
          { ...baseConditions[0], isReleased: true },
          { ...baseConditions[1] },
        ],
      };
      escrowRepo.findOne.mockResolvedValue(escrowWithFirstReleased);
      partyRepo.find.mockResolvedValue([]);

      const event2 = { ...mockEvent, milestoneIndex: 1, amount: 200 };
      await (service as any).handleMilestoneReleased(event2);

      expect(escrowRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          releasedAmount: 300, // 100 + 200
        }),
      );
    });

    it('should log warning if condition index is out of range', async () => {
      const eventBadIndex = { ...mockEvent, milestoneIndex: 5 };
      escrowRepo.findOne.mockResolvedValue({
        ...baseEscrow,
        conditions: [...baseConditions.map((c) => ({ ...c }))],
      });
      const warnSpy = jest.spyOn((service as any).logger, 'warn');

      await (service as any).handleMilestoneReleased(eventBadIndex);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Condition at index 5 not found'),
      );
      expect(conditionRepo.save).not.toHaveBeenCalled();
    });

    it('should not throw if WebSocket broadcast fails', async () => {
      escrowRepo.findOne.mockResolvedValue({
        ...baseEscrow,
        conditions: [...baseConditions.map((c) => ({ ...c }))],
      });
      partyRepo.find.mockResolvedValue([]);
      escrowGateway.broadcastMilestoneReleased.mockImplementation(() => {
        throw new Error('WebSocket error');
      });
      const errorSpy = jest.spyOn((service as any).logger, 'error');

      // Should not throw
      await (service as any).handleMilestoneReleased(mockEvent);

      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to broadcast milestone released WebSocket event',
        expect.any(Error),
      );
      // DB changes should still be saved
      expect(conditionRepo.save).toHaveBeenCalled();
    });

    it('should not create notifications while updating the milestone', async () => {
      escrowRepo.findOne.mockResolvedValue({
        ...baseEscrow,
        conditions: [...baseConditions.map((c) => ({ ...c }))],
      });
      await (service as any).handleMilestoneReleased(mockEvent);

      expect(notificationService.handleEscrowEvent).not.toHaveBeenCalled();
      // DB changes should still be saved
      expect(conditionRepo.save).toHaveBeenCalled();
    });
  });

  describe('stopEventListener', () => {
    it('should set isRunning to false', async () => {
      await service.startEventListener();
      await service.stopEventListener();
      expect(service.getSyncStatus().isRunning).toBe(false);
    });
  });
});
