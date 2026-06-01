import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EscrowEventStore, EscrowEventStoreType } from '../entities/escrow-event-store.entity';
import { EscrowEventStoreService } from './escrow-event-store.service';
import { EscrowService } from './escrow.service';
import { Escrow, EscrowStatus } from '../entities/escrow.entity';

describe('EscrowEventStoreService', () => {
  let service: EscrowEventStoreService;
  let eventStoreRepo: jest.Mocked<Repository<EscrowEventStore>>;

  const mockEventStoreRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockEscrowService = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowEventStoreService,
        { provide: getRepositoryToken(EscrowEventStore), useValue: mockEventStoreRepo },
        { provide: EscrowService, useValue: mockEscrowService },
      ],
    }).compile();

    service = module.get<EscrowEventStoreService>(EscrowEventStoreService);
    eventStoreRepo = module.get(getRepositoryToken(EscrowEventStore));
    jest.clearAllMocks();
  });

  describe('append', () => {
    it('should append an event with a monotonic cursor', async () => {
      const lastEvent = { cursor: '5' } as EscrowEventStore;
      mockEventStoreRepo.findOne.mockResolvedValueOnce(lastEvent);
      const createdEvent = { cursor: '6' } as EscrowEventStore;
      mockEventStoreRepo.create.mockReturnValue(createdEvent);
      mockEventStoreRepo.save.mockResolvedValue(createdEvent);

      const result = await service.append({
        escrowId: 'escrow-1',
        eventType: EscrowEventStoreType.CREATED,
        actorId: 'user-1',
        payload: { key: 'value' },
      });

      expect(mockEventStoreRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          escrowId: 'escrow-1',
          eventType: EscrowEventStoreType.CREATED,
          cursor: '6',
        }),
      );
      expect(mockEventStoreRepo.save).toHaveBeenCalledWith(createdEvent);
      expect(result).toBe(createdEvent);
    });

    it('should start cursor at 1 when no prior events exist', async () => {
      mockEventStoreRepo.findOne.mockResolvedValueOnce(null);
      const createdEvent = { cursor: '1' } as EscrowEventStore;
      mockEventStoreRepo.create.mockReturnValue(createdEvent);
      mockEventStoreRepo.save.mockResolvedValue(createdEvent);

      const result = await service.append({
        escrowId: 'escrow-1',
        eventType: EscrowEventStoreType.CREATED,
      });

      expect(mockEventStoreRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: '1' }),
      );
      expect(result.cursor).toBe('1');
    });

    it('should reject duplicate idempotency keys', async () => {
      const existingEvent = { id: 'existing', idempotencyKey: 'dup-key' } as EscrowEventStore;
      mockEventStoreRepo.findOne.mockResolvedValueOnce(existingEvent);

      const result = await service.append({
        escrowId: 'escrow-1',
        eventType: EscrowEventStoreType.FUNDED,
        idempotencyKey: 'dup-key',
      });

      expect(mockEventStoreRepo.save).not.toHaveBeenCalled();
      expect(result).toBe(existingEvent);
    });
  });

  describe('query', () => {
    it('should return paginated events', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([
          [
            { id: '1', escrowId: 'e1', eventType: 'CREATED', cursor: '1' } as EscrowEventStore,
            { id: '2', escrowId: 'e1', eventType: 'FUNDED', cursor: '2' } as EscrowEventStore,
          ],
          2,
        ]),
      };
      mockEventStoreRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.query({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  describe('getTimeline', () => {
    it('should return a human-readable timeline', async () => {
      const events = [
        { id: '1', escrowId: 'e1', eventType: EscrowEventStoreType.CREATED, actorId: 'u1', payload: {}, createdAt: new Date(), cursor: '1' } as EscrowEventStore,
        { id: '2', escrowId: 'e1', eventType: EscrowEventStoreType.FUNDED, actorId: 'u2', payload: { txHash: 'abc' }, createdAt: new Date(), cursor: '2' } as EscrowEventStore,
      ];
      mockEventStoreRepo.find.mockResolvedValue(events);

      const result = await service.getTimeline('e1');

      expect(result.escrowId).toBe('e1');
      expect(result.timeline).toHaveLength(2);
      expect(result.timeline[0].summary).toContain('Escrow was created');
      expect(result.timeline[1].summary).toContain('Escrow was funded');
    });
  });

  describe('replayAndCheck', () => {
    it('should reconstruct state from events and detect consistency', async () => {
      const events = [
        { id: '1', escrowId: 'e1', eventType: EscrowEventStoreType.CREATED, payload: {}, cursor: '1' } as EscrowEventStore,
        { id: '2', escrowId: 'e1', eventType: EscrowEventStoreType.FUNDED, payload: {}, cursor: '2' } as EscrowEventStore,
        { id: '3', escrowId: 'e1', eventType: EscrowEventStoreType.RELEASED, payload: {}, cursor: '3' } as EscrowEventStore,
      ];
      mockEventStoreRepo.find.mockResolvedValue(events);
      mockEscrowService.findOne.mockResolvedValue({ status: EscrowStatus.COMPLETED } as Escrow);

      const result = await service.replayAndCheck('e1');

      expect(result.totalEventsReplayed).toBe(3);
      expect(result.reconstructedState.status).toBe('COMPLETED');
      expect(result.isConsistent).toBe(true);
    });

    it('should detect inconsistencies between replayed and DB state', async () => {
      const events = [
        { id: '1', escrowId: 'e1', eventType: EscrowEventStoreType.CREATED, payload: {}, cursor: '1' } as EscrowEventStore,
        { id: '2', escrowId: 'e1', eventType: EscrowEventStoreType.FUNDED, payload: {}, cursor: '2' } as EscrowEventStore,
        { id: '3', escrowId: 'e1', eventType: EscrowEventStoreType.RELEASED, payload: {}, cursor: '3' } as EscrowEventStore,
      ];
      mockEventStoreRepo.find.mockResolvedValue(events);
      mockEscrowService.findOne.mockResolvedValue({ status: EscrowStatus.CANCELLED } as Escrow);

      const result = await service.replayAndCheck('e1');

      expect(result.isConsistent).toBe(false);
      expect(result.inconsistencies).toBeDefined();
      expect(result.inconsistencies![0]).toContain('Status mismatch');
    });
  });

  describe('immutability guarantee', () => {
    it('should not have any update or delete methods exposed', () => {
      const methods = Object.getOwnPropertyNames(
        Object.getPrototypeOf(service),
      ).filter((m) => m !== 'constructor');

      expect(methods).toContain('append');
      expect(methods).toContain('query');
      expect(methods).toContain('getTimeline');
      expect(methods).toContain('replayAndCheck');
      expect(methods).toContain('existsByIdempotencyKey');

      expect(methods).not.toContain('update');
      expect(methods).not.toContain('delete');
      expect(methods).not.toContain('remove');
    });
  });
});
