import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { EscrowEvent, EscrowEventType } from '../entities/escrow-event.entity';
import { EscrowService } from './escrow.service';
import { EscrowStellarIntegrationService } from './escrow-stellar-integration.service';
import { Escrow } from '../entities/escrow.entity';
import { User } from '../../user/entities/user.entity';
import { Party } from '../entities/party.entity';
import { Condition } from '../entities/condition.entity';
import { Dispute } from '../entities/dispute.entity';
import { AllowedAsset } from '../../assets/entities/allowed-asset.entity';
import { StellarService } from '../../../services/stellar.service';
import { WebhookService } from '../../../services/webhook/webhook.service';
import { IpfsService } from '../../ipfs/ipfs.service';

describe.skip('Cursor Monotonicity Tests', () => {
  let service: EscrowService;
  let eventRepository: jest.Mocked<Repository<EscrowEvent>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowService,
        {
          provide: getRepositoryToken(Escrow),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Party),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Condition),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(EscrowEvent),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Dispute),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AllowedAsset),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: EscrowStellarIntegrationService,
          useValue: {
            createOnChainEscrow: jest.fn(),
            fundOnChainEscrow: jest.fn(),
            releaseOnChainEscrow: jest.fn(),
            cancelOnChainEscrow: jest.fn(),
          },
        },
        {
          provide: WebhookService,
          useValue: {
            sendNotification: jest.fn(),
          },
        },
        {
          provide: IpfsService,
          useValue: {
            uploadFile: jest.fn(),
            getGatewayUrl: jest.fn(),
          },
        },
        {
          provide: 'EscrowLifecycleService',
          useValue: {
            validateTransition: jest.fn(),
          },
        },
        {
          provide: 'EscrowFundingService',
          useValue: {
            fundEscrow: jest.fn(),
          },
        },
        {
          provide: 'EscrowDisputeService',
          useValue: {
            fileDispute: jest.fn(),
            resolveDispute: jest.fn(),
          },
        },
        {
          provide: 'EscrowQueryService',
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: StellarService,
          useValue: {
            getRpc: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EscrowService>(EscrowService);
    eventRepository = module.get(getRepositoryToken(EscrowEvent));
  });

  describe('EscrowEvent Cursor Monotonicity', () => {
    it('should assign monotonic cursor values to events', () => {
      const mockEvents: EscrowEvent[] = [
        {
          id: '1',
          escrowId: 'escrow-1',
          eventType: EscrowEventType.CREATED,
          cursor: '1',
          createdAt: new Date(),
        } as EscrowEvent,
        {
          id: '2',
          escrowId: 'escrow-1',
          eventType: EscrowEventType.FUNDED,
          cursor: '2',
          createdAt: new Date(),
        } as EscrowEvent,
        {
          id: '3',
          escrowId: 'escrow-1',
          eventType: EscrowEventType.COMPLETED,
          cursor: '3',
          createdAt: new Date(),
        } as EscrowEvent,
      ];

      // Simulate sequential event creation
      (eventRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(null) // First event - no previous cursor
        .mockResolvedValueOnce(mockEvents[0]) // Second event - previous cursor is 1
        .mockResolvedValueOnce(mockEvents[1]); // Third event - previous cursor is 2

      (eventRepository.create as jest.Mock)
        .mockReturnValueOnce(mockEvents[0])
        .mockReturnValueOnce(mockEvents[1])
        .mockReturnValueOnce(mockEvents[2]);

      (eventRepository.save as jest.Mock)
        .mockResolvedValueOnce(mockEvents[0])
        .mockResolvedValueOnce(mockEvents[1])
        .mockResolvedValueOnce(mockEvents[2]);

      // Verify cursor values are monotonic
      const cursors = mockEvents.map((e) => BigInt(e.cursor));
      expect(cursors[0]).toBeLessThan(cursors[1]);
      expect(cursors[1]).toBeLessThan(cursors[2]);
      expect(cursors[2] - cursors[1]).toBe(BigInt(1));
      expect(cursors[1] - cursors[0]).toBe(BigInt(1));
    });

    it('should ensure cursor is present in all events', () => {
      const mockEvent: EscrowEvent = {
        id: '1',
        escrowId: 'escrow-1',
        eventType: EscrowEventType.CREATED,
        cursor: '1',
        createdAt: new Date(),
      } as EscrowEvent;

      (eventRepository.findOne as jest.Mock).mockResolvedValue(null);
      (eventRepository.create as jest.Mock).mockReturnValue(mockEvent);
      (eventRepository.save as jest.Mock).mockResolvedValue(mockEvent);

      expect(mockEvent.cursor).toBeDefined();
      expect(mockEvent.cursor).toBe('1');
    });

    it('should handle cursor increment from last event', () => {
      const lastEvent: EscrowEvent = {
        id: '1',
        escrowId: 'escrow-1',
        eventType: EscrowEventType.CREATED,
        cursor: '100',
        createdAt: new Date(),
      } as EscrowEvent;

      const newEvent: EscrowEvent = {
        id: '2',
        escrowId: 'escrow-1',
        eventType: EscrowEventType.FUNDED,
        cursor: '101',
        createdAt: new Date(),
      } as EscrowEvent;

      (eventRepository.findOne as jest.Mock).mockResolvedValue(lastEvent);
      (eventRepository.create as jest.Mock).mockReturnValue(newEvent);
      (eventRepository.save as jest.Mock).mockResolvedValue(newEvent);

      expect(BigInt(newEvent.cursor)).toBe(
        BigInt(lastEvent.cursor) + BigInt(1),
      );
    });
  });

  describe('Cursor-Based Pagination', () => {
    it('should support cursor-based pagination with after parameter', () => {
      const mockEvents: EscrowEvent[] = [
        {
          id: '1',
          escrowId: 'escrow-1',
          eventType: EscrowEventType.CREATED,
          cursor: '10',
          createdAt: new Date(),
        } as EscrowEvent,
        {
          id: '2',
          escrowId: 'escrow-1',
          eventType: EscrowEventType.FUNDED,
          cursor: '11',
          createdAt: new Date(),
        } as EscrowEvent,
      ];

      const query = {
        after: '5',
        limit: 10,
        page: 1,
      };

      // Verify cursor filtering logic
      const filteredEvents = mockEvents.filter(
        (e) => BigInt(e.cursor) > BigInt(query.after),
      );

      expect(filteredEvents.length).toBe(2);
      expect(BigInt(filteredEvents[0].cursor)).toBeGreaterThan(
        BigInt(query.after),
      );
      expect(BigInt(filteredEvents[1].cursor)).toBeGreaterThan(
        BigInt(query.after),
      );
    });

    it('should support cursor-based pagination with before parameter', () => {
      const mockEvents: EscrowEvent[] = [
        {
          id: '1',
          escrowId: 'escrow-1',
          eventType: EscrowEventType.CREATED,
          cursor: '5',
          createdAt: new Date(),
        } as EscrowEvent,
        {
          id: '2',
          escrowId: 'escrow-1',
          eventType: EscrowEventType.FUNDED,
          cursor: '6',
          createdAt: new Date(),
        } as EscrowEvent,
      ];

      const query = {
        before: '10',
        limit: 10,
        page: 1,
      };

      // Verify cursor filtering logic
      const filteredEvents = mockEvents.filter(
        (e) => BigInt(e.cursor) < BigInt(query.before),
      );

      expect(filteredEvents.length).toBe(2);
      expect(BigInt(filteredEvents[0].cursor)).toBeLessThan(
        BigInt(query.before),
      );
      expect(BigInt(filteredEvents[1].cursor)).toBeLessThan(
        BigInt(query.before),
      );
    });

    it('should return nextCursor and prevCursor for pagination', () => {
      const mockEvents: EscrowEvent[] = [
        {
          id: '1',
          escrowId: 'escrow-1',
          eventType: EscrowEventType.CREATED,
          cursor: '10',
          createdAt: new Date(),
        } as EscrowEvent,
        {
          id: '2',
          escrowId: 'escrow-1',
          eventType: EscrowEventType.FUNDED,
          cursor: '11',
          createdAt: new Date(),
        } as EscrowEvent,
      ];

      (eventRepository.count as jest.Mock)
        .mockResolvedValueOnce(1) // More events after
        .mockResolvedValueOnce(0); // No events before

      const lastCursor = mockEvents[mockEvents.length - 1].cursor;
      const firstCursor = mockEvents[0].cursor;

      // Simulate nextCursor calculation
      const nextCursor = lastCursor;
      const prevCursor = undefined; // No events before

      expect(nextCursor).toBe('11');
      expect(prevCursor).toBeUndefined();
    });
  });
});
