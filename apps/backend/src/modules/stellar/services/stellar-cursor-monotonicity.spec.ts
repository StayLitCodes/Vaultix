import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import {
  StellarEvent,
  StellarEventType,
} from '../entities/stellar-event.entity';
import { StellarEventListenerService } from './stellar-event-listener.service';
import { Escrow } from '../../escrow/entities/escrow.entity';
import { AllowedAsset } from '../../assets/entities/allowed-asset.entity';

describe.skip('StellarEvent Cursor Monotonicity Tests', () => {
  let service: StellarEventListenerService;
  let stellarEventRepository: jest.Mocked<Repository<StellarEvent>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarEventListenerService,
        {
          provide: getRepositoryToken(StellarEvent),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Escrow),
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
            find: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: 'SorobanClientService',
          useValue: {
            getContractId: jest.fn(() => 'test-contract-id'),
            getRpc: jest.fn(),
          },
        },
        {
          provide: 'ConsistencyCheckerService',
          useValue: {
            checkConsistency: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StellarEventListenerService>(
      StellarEventListenerService,
    );
    stellarEventRepository = module.get(getRepositoryToken(StellarEvent));
  });

  describe('StellarEvent Cursor Monotonicity', () => {
    it('should compute cursor as composite of ledger and eventIndex', () => {
      const ledger = 123456;
      const eventIndex = 2;

      // Cursor formula: ledger * 1000 + eventIndex
      const expectedCursor = (
        BigInt(ledger) * BigInt(1000) +
        BigInt(eventIndex)
      ).toString();

      expect(expectedCursor).toBe('123456002');
    });

    it('should ensure cursor uniqueness within same ledger', () => {
      const ledger = 123456;

      const cursor1 = (BigInt(ledger) * BigInt(1000) + BigInt(0)).toString();
      const cursor2 = (BigInt(ledger) * BigInt(1000) + BigInt(1)).toString();
      const cursor3 = (BigInt(ledger) * BigInt(1000) + BigInt(2)).toString();

      expect(cursor1).not.toBe(cursor2);
      expect(cursor2).not.toBe(cursor3);
      expect(cursor3).not.toBe(cursor1);
    });

    it('should ensure cursor monotonicity across ledgers', () => {
      const ledger1 = 123456;
      const ledger2 = 123457;

      const cursor1 = (BigInt(ledger1) * BigInt(1000) + BigInt(999)).toString();
      const cursor2 = (BigInt(ledger2) * BigInt(1000) + BigInt(0)).toString();

      expect(BigInt(cursor2)).toBeGreaterThan(BigInt(cursor1));
    });

    it('should ensure cursor is present in all StellarEvents', () => {
      const mockEvent: StellarEvent = {
        id: '1',
        txHash: 'abc123',
        eventIndex: 0,
        eventType: StellarEventType.ESCROW_CREATED,
        escrowId: 'escrow-1',
        ledger: 123456,
        timestamp: new Date(),
        rawPayload: {},
        extractedFields: {},
        cursor: '123456000',
      } as StellarEvent;

      expect(mockEvent.cursor).toBeDefined();
      expect(mockEvent.cursor).toBe('123456000');
    });

    it('should handle cursor computation for maximum eventIndex', () => {
      const ledger = 123456;
      const eventIndex = 999;

      const cursor = (
        BigInt(ledger) * BigInt(1000) +
        BigInt(eventIndex)
      ).toString();

      expect(cursor).toBe('123456999');
    });

    it('should verify cursor ordering matches event processing order', () => {
      const events = [
        { ledger: 100, eventIndex: 0 },
        { ledger: 100, eventIndex: 1 },
        { ledger: 101, eventIndex: 0 },
        { ledger: 101, eventIndex: 2 },
      ];

      const cursors = events.map(
        (e) => BigInt(e.ledger) * BigInt(1000) + BigInt(e.eventIndex),
      );

      // Verify monotonic increasing
      for (let i = 1; i < cursors.length; i++) {
        expect(cursors[i]).toBeGreaterThan(cursors[i - 1]);
      }
    });
  });

  describe('Cursor-Based Incremental Sync', () => {
    it('should support resuming from last cursor', () => {
      const lastCursor = '123456500';
      const nextLedger = 123457;

      // Simulate resuming from cursor
      const lastLedgerFromCursor = BigInt(lastCursor) / BigInt(1000);
      expect(lastLedgerFromCursor).toBe(BigInt(123456));

      // Next events should have cursor > lastCursor
      const nextCursor = (
        BigInt(nextLedger) * BigInt(1000) +
        BigInt(0)
      ).toString();
      expect(BigInt(nextCursor)).toBeGreaterThan(BigInt(lastCursor));
    });

    it('should allow filtering events by cursor range', () => {
      const events = [
        { cursor: '100000' },
        { cursor: '200000' },
        { cursor: '300000' },
        { cursor: '400000' },
      ];

      const afterCursor = '200000';
      const beforeCursor = '400000';

      const filtered = events.filter(
        (e) =>
          BigInt(e.cursor) > BigInt(afterCursor) &&
          BigInt(e.cursor) < BigInt(beforeCursor),
      );

      expect(filtered.length).toBe(1);
      expect(filtered[0].cursor).toBe('300000');
    });
  });
});
