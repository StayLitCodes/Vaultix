import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from './audit-log.service';
import { AuditLog } from './entities/audit-log.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let repo: jest.Mocked<Pick<Repository<AuditLog>, 'create' | 'save' | 'findAndCount'>>;

  beforeEach(async () => {
    repo = {
      create: jest.fn().mockReturnValue({ id: 'log-1' }),
      save: jest.fn().mockResolvedValue({ id: 'log-1' }),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
  });

  describe('log', () => {
    it('should create and fire-and-forget save an audit log entry', () => {
      const entry = {
        entityType: 'escrow',
        entityId: 'escrow-123',
        action: 'escrow.created',
        actorId: 'user-1',
        actorRole: 'creator',
        previousState: { status: 'pending' },
        newState: { status: 'created' },
        ipAddress: '127.0.0.1',
        metadata: { title: 'Test Escrow' },
      };

      service.log(entry);

      expect(repo.create).toHaveBeenCalledWith({
        entityType: 'escrow',
        entityId: 'escrow-123',
        action: 'escrow.created',
        actorId: 'user-1',
        actorRole: 'creator',
        previousState: { status: 'pending' },
        newState: { status: 'created' },
        ipAddress: '127.0.0.1',
        userAgent: null,
        metadata: { title: 'Test Escrow' },
      });
      expect(repo.save).toHaveBeenCalled();
    });

    it('should handle null/undefined optional fields gracefully', () => {
      service.log({
        entityType: 'escrow',
        entityId: 'escrow-456',
        action: 'escrow.expired',
      });

      expect(repo.create).toHaveBeenCalledWith({
        entityType: 'escrow',
        entityId: 'escrow-456',
        action: 'escrow.expired',
        actorId: null,
        actorRole: null,
        previousState: null,
        newState: null,
        ipAddress: null,
        userAgent: null,
        metadata: null,
      });
    });

    it('should not throw on save failure (fire-and-forget)', () => {
      repo.save.mockRejectedValueOnce(new Error('DB down'));

      // Should not throw
      expect(() =>
        service.log({
          entityType: 'escrow',
          entityId: 'escrow-1',
          action: 'test',
        }),
      ).not.toThrow();
    });
  });

  describe('findByEntity', () => {
    it('should filter by entityType and entityId', async () => {
      repo.findAndCount.mockResolvedValue([[{ id: '1' } as AuditLog], 1]);

      const result = await service.findByEntity('escrow', 'escrow-123');

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { entityType: 'escrow', entityId: 'escrow-123' },
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should support pagination', async () => {
      await service.findByEntity('escrow', 'escrow-123', { page: 3, pageSize: 25 });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 50,
          take: 25,
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return default paginated results', async () => {
      await service.findAll();

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 50,
        }),
      );
    });

    it('should apply all filters', async () => {
      const from = new Date('2025-01-01');
      const to = new Date('2025-01-31');

      await service.findAll({
        entityType: 'user',
        entityId: 'user-1',
        action: 'user.suspended',
        actorId: 'admin-1',
        actorRole: 'admin',
        from,
        to,
        page: 2,
        pageSize: 10,
      });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entityType: 'user',
            entityId: 'user-1',
            action: 'user.suspended',
            actorId: 'admin-1',
            actorRole: 'admin',
          }),
          skip: 10,
          take: 10,
        }),
      );
    });

    it('should apply from-only date filter', async () => {
      const from = new Date('2025-06-01');

      await service.findAll({ from });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.anything(),
          }),
        }),
      );
    });

    it('should apply to-only date filter', async () => {
      const to = new Date('2025-06-30');

      await service.findAll({ to });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.anything(),
          }),
        }),
      );
    });

    it('should apply from+to date filter', async () => {
      const from = new Date('2025-06-01');
      const to = new Date('2025-06-30');

      await service.findAll({ from, to });

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.anything(),
          }),
        }),
      );
    });
  });
});
