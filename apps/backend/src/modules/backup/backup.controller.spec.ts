import { Test, TestingModule } from '@nestjs/testing';
import { BackupController } from './backup.controller';
import { BackupService } from './services/backup.service';
import {
  BackupStatus,
  BackupRetentionPolicy,
} from './entities/backup-record.entity';
import { AuthGuard } from '../auth/middleware/auth.guard';
import { AdminGuard } from '../auth/middleware/admin.guard';

describe('BackupController', () => {
  let controller: BackupController;
  let backupService: jest.Mocked<BackupService>;

  beforeEach(async () => {
    backupService = {
      triggerBackup: jest.fn(),
      getBackupStatus: jest.fn(),
      verifyBackup: jest.fn(),
      applyRetentionPolicy: jest.fn(),
    } as unknown as jest.Mocked<BackupService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BackupController],
      providers: [{ provide: BackupService, useValue: backupService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BackupController>(BackupController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /admin/backup/trigger', () => {
    it('should trigger a backup and return the result', async () => {
      const mockRecord = {
        id: 'uuid-123',
        filename: 'vaultix_backup_2026-01-15_020000.db',
        sizeBytes: 2048,
        status: BackupStatus.COMPLETED,
        encrypted: true,
        localPath: '/data/backups/vaultix_backup_2026-01-15_020000.db',
        remotePath: 's3://bucket/vaultix/backups/test.db.enc',
        createdAt: new Date('2026-01-15T02:00:00Z'),
      };

      backupService.triggerBackup.mockResolvedValue(mockRecord as any);

      const result = await controller.triggerBackup({ note: 'manual test' });

      expect(backupService.triggerBackup).toHaveBeenCalledWith({
        note: 'manual test',
      });
      expect(result.id).toBe('uuid-123');
      expect(result.status).toBe('completed');
      expect(result.encrypted).toBe(true);
      expect(result.sizeBytes).toBe(2048);
    });
  });

  describe('GET /admin/backup/status', () => {
    it('should return backup status', async () => {
      const mockStatus = {
        lastBackup: {
          id: 'uuid-1',
          filename: 'test.db.enc',
          sizeBytes: 1024,
          status: 'completed',
          createdAt: '2026-01-15T02:00:00Z',
          localPath: '/data/backups/test.db.enc',
          remotePath: null,
          encrypted: true,
        },
        totalBackups: 10,
        totalSizeBytes: 10240,
        storageQuota: {
          usedBytes: 10240,
          quotaBytes: 10737418240,
          usagePercent: 0.0001,
          alertThreshold: 80,
          isOverThreshold: false,
        },
        retentionSummary: { daily: 7, weekly: 4, monthly: 3 },
        nextScheduledBackup: '2026-01-16T02:00:00Z',
      };

      backupService.getBackupStatus.mockResolvedValue(mockStatus);

      const result = await controller.getBackupStatus();

      expect(result.totalBackups).toBe(10);
      expect(result.storageQuota.isOverThreshold).toBe(false);
      expect(result.retentionSummary.daily).toBe(7);
    });
  });

  describe('POST /admin/backup/:id/verify', () => {
    it('should verify a backup', async () => {
      backupService.verifyBackup.mockResolvedValue({
        verified: true,
        originalChecksum: 'abc123',
        restoreChecksum: 'abc123',
        verifiedAt: '2026-01-15T10:00:00Z',
      });

      const result = await controller.verifyBackup('uuid-1');

      expect(backupService.verifyBackup).toHaveBeenCalledWith('uuid-1');
      expect(result.verified).toBe(true);
      expect(result.originalChecksum).toBe(result.restoreChecksum);
    });
  });

  describe('POST /admin/backup/retention/apply', () => {
    it('should apply retention policy', async () => {
      backupService.applyRetentionPolicy.mockResolvedValue({
        deletedCount: 3,
        deletedIds: ['id-1', 'id-2', 'id-3'],
      });

      const result = await controller.applyRetentionPolicy();

      expect(result.deletedCount).toBe(3);
      expect(result.deletedIds).toHaveLength(3);
    });
  });
});
