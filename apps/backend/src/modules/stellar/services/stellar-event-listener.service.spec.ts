import { Test, TestingModule } from '@nestjs/testing';
import { StellarEventListenerService } from './stellar-event-listener.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  StellarEvent,
  StellarEventType,
} from '../entities/stellar-event.entity';
import { Escrow, EscrowStatus } from '../../escrow/entities/escrow.entity';
import { SorobanClientService } from '../../../services/stellar/soroban-client.service';
import { ConfigService } from '@nestjs/config';
import { ConsistencyCheckerService } from '../../admin/services/consistency-checker.service';

describe('StellarEventListenerService', () => {
  let service: StellarEventListenerService;
  let stellarEventRepo: jest.Mocked<any>;
  let escrowRepo: jest.Mocked<any>;
  let sorobanClient: jest.Mocked<any>;
  let rpcServer: jest.Mocked<any>;

  beforeEach(async () => {
    rpcServer = {
      getLatestLedger: jest.fn().mockResolvedValue({ sequence: 100 }),
      getEvents: jest.fn().mockResolvedValue({ events: [] }),
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
      ],
    }).compile();

    service = module.get<StellarEventListenerService>(
      StellarEventListenerService,
    );
    stellarEventRepo = module.get(getRepositoryToken(StellarEvent));
    escrowRepo = module.get(getRepositoryToken(Escrow));
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

  describe('stopEventListener', () => {
    it('should set isRunning to false', async () => {
      await service.startEventListener();
      await service.stopEventListener();
      expect(service.getSyncStatus().isRunning).toBe(false);
    });
  });
});
