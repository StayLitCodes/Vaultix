import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BackupService } from './backup.service';
import {
  BackupRecord,
  BackupStatus,
  BackupType,
  BackupRetentionPolicy,
} from '../entities/backup-record.entity';
import { AdminAuditLogService } from '../../admin/services/admin-audit-log.service';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  statSync: jest.fn().mockReturnValue({ size: 1024 }),
  readFileSync: jest.fn().mockReturnValue(Buffer.from('test')),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  createReadStream: jest.fn().mockReturnValue({
    on: jest.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'data') cb(Buffer.from('test-data'));
      if (event === 'end') cb();
      return { on: jest.fn() };
    }),
    pipe: jest.fn(),
  }),
  createWriteStream: jest.fn().mockReturnValue({
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'finish') cb();
      return { on: jest.fn() };
    }),
  }),
  openSync: jest.fn().mockReturnValue(1),
  readSync: jest.fn().mockImplementation((_fd: number, buffer: Buffer) => {
    // Write valid SQLite header into the buffer
    const header = 'SQLite format 3';
    header.split('').forEach((char, i) => {
      buffer[i] = char.charCodeAt(0);
    });
    return 16;
  }),
  closeSync: jest.fn(),
  readdirSync: jest.fn().mockReturnValue([]),
  rmdirSync: jest.fn(),
  copyFileSync: jest.fn(),
}));

// Mock sqlite3
jest.mock('sqlite3', () => ({
  verbose: jest.fn().mockReturnValue({
    Database: jest.fn().mockImplementation(() => ({
      backup: jest.fn().mockReturnValue({
        step: jest.fn().mockResolvedValue(undefined),
        finish: jest.fn().mockResolvedValue(undefined),
      }),
      close: jest.fn((cb: (err: Error | null) => void) => cb?.(null)),
    })),
  }),
}));

describe('BackupService', () => {
  let service: BackupService;
  let backupRepo: any;
  let auditLogService: any;
  let configService: any;

  beforeEach(async () => {
    backupRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      find: jest.fn().mockResolvedValue([]),
      remove: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
      }),
    };

    auditLogService = {
      create: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string, defaultVal?: unknown) => {
        const config: Record<string, unknown> = {
          DATABASE_PATH: './data/vaultix.db',
          BACKUP_LOCAL_DIR: '/tmp/backups',
          BACKUP_S3_BUCKET: '',
          BACKUP_S3_PREFIX: 'vaultix/backups',
          BACKUP_ENCRYPTION_KEY: '',
          BACKUP_STORAGE_QUOTA_BYTES: 10737418240,
          BACKUP_ALERT_THRESHOLD_PERCENT: 80,
        };
        return config[key] ?? defaultVal;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackupService,
        {
          provide: getRepositoryToken(BackupRecord),
          useValue: backupRepo,
        },
        {
          provide: AdminAuditLogService,
          useValue: auditLogService,
        },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<BackupService>(BackupService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('triggerBackup', () => {
    it('should create a backup record and return it', async () => {
      const mockRecord = {
        id: 'uuid-123',
        filename: 'vaultix_backup_2026-01-01_020000.db',
        sizeBytes: 1024,
        status: BackupStatus.COMPLETED,
        backupType: BackupType.MANUAL,
        retentionPolicy: BackupRetentionPolicy.DAILY,
        encrypted: false,
        localPath: '/tmp/backups/vaultix_backup_2026-01-01_020000.db',
        remotePath: null,
        createdAt: new Date(),
        metadata: undefined,
      };

      backupRepo.create.mockReturnValue({
        ...mockRecord,
        status: BackupStatus.IN_PROGRESS,
      });
      backupRepo.save.mockImplementation((record: Partial<BackupRecord>) =>
        Promise.resolve({ ...mockRecord, ...record }),
      );

      // Mock internal methods to avoid sqlite3 native module issues in tests
      jest
        .spyOn(service as any, 'createSqliteBackup')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'calculateChecksum')
        .mockResolvedValue('abc123');
      jest
        .spyOn(service as any, 'preBackupConsistencyCheck')
        .mockImplementation(() => undefined);
      jest
        .spyOn(service as any, 'checkStorageQuota')
        .mockResolvedValue(undefined);

      const result = await service.triggerBackup({
        note: 'test backup',
      });

      expect(backupRepo.create).toHaveBeenCalled();
      expect(backupRepo.save).toHaveBeenCalledTimes(2); // Once for IN_PROGRESS, once for COMPLETED
      expect(result.status).toBe(BackupStatus.COMPLETED);
    });

    it('should set FAILED status on error', async () => {
      backupRepo.create.mockReturnValue({
        status: BackupStatus.IN_PROGRESS,
        filename: 'test.db',
      });
      backupRepo.save.mockImplementation((record: Partial<BackupRecord>) =>
        Promise.resolve({ ...record, id: 'uuid-1' }),
      );

      // Make the backup step fail
      jest
        .spyOn(service as any, 'createSqliteBackup')
        .mockRejectedValue(new Error('Backup failed'));

      await expect(service.triggerBackup()).rejects.toThrow();
      expect(backupRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: BackupStatus.FAILED,
        }),
      );
    });
  });

  describe('getBackupStatus', () => {
    it('should return backup status with no previous backups', async () => {
      backupRepo.findOne.mockResolvedValue(null);
      backupRepo.count.mockResolvedValue(0);
      backupRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
      });

      const result = await service.getBackupStatus();

      expect(result.lastBackup).toBeNull();
      expect(result.totalBackups).toBe(0);
      expect(result.totalSizeBytes).toBe(0);
      expect(result.storageQuota.isOverThreshold).toBe(false);
    });

    it('should return last backup info', async () => {
      const mockBackup = {
        id: 'uuid-1',
        filename: 'test.db.enc',
        sizeBytes: 5000,
        status: BackupStatus.COMPLETED,
        createdAt: new Date('2026-01-15'),
        localPath: '/tmp/backups/test.db.enc',
        remotePath: 's3://bucket/test.db.enc',
        encrypted: true,
      };

      backupRepo.findOne.mockResolvedValue(mockBackup);
      backupRepo.count.mockResolvedValue(5);
      backupRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '5000' }),
      });

      const result = await service.getBackupStatus();

      expect(result.lastBackup).not.toBeNull();
      expect(result.lastBackup!.id).toBe('uuid-1');
      expect(result.lastBackup!.encrypted).toBe(true);
      expect(result.totalBackups).toBe(5);
    });
  });

  describe('verifyBackup', () => {
    it('should throw for non-existent backup', async () => {
      backupRepo.findOne.mockResolvedValue(null);
      await expect(service.verifyBackup('non-existent')).rejects.toThrow(
        'not found',
      );
    });
  });

  describe('applyRetentionPolicy', () => {
    it('should delete expired daily backups', async () => {
      const expiredBackup = {
        id: 'exp-1',
        localPath: '/tmp/expired.db',
        remotePath: null,
        retentionPolicy: BackupRetentionPolicy.DAILY,
        status: BackupStatus.COMPLETED,
      };

      backupRepo.find.mockResolvedValueOnce([expiredBackup]); // daily
      backupRepo.find.mockResolvedValueOnce([]); // weekly
      backupRepo.find.mockResolvedValueOnce([]); // monthly

      const result = await service.applyRetentionPolicy();

      expect(result.deletedCount).toBe(1);
      expect(result.deletedIds).toContain('exp-1');
      expect(backupRepo.remove).toHaveBeenCalledWith(expiredBackup);
    });

    it('should return empty when no backups are expired', async () => {
      backupRepo.find.mockResolvedValue([]);
      const result = await service.applyRetentionPolicy();

      expect(result.deletedCount).toBe(0);
      expect(result.deletedIds).toHaveLength(0);
    });
  });
});
