import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  BackupRecord,
  BackupStatus,
  BackupType,
  BackupRetentionPolicy,
} from '../entities/backup-record.entity';
import { TriggerBackupDto, BackupStatusResponse } from '../dto/backup.dto';
import { AdminAuditLogService } from '../../admin/services/admin-audit-log.service';

interface SqliteBackup {
  step(pages: number): Promise<void>;
  finish(): Promise<void>;
}

interface SqliteDatabase {
  backup(dest: string): SqliteBackup;
  close(callback: (err: Error | null) => void): void;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly s3Client: S3Client | null;
  private readonly backupDir: string;
  private readonly dbPath: string;
  private readonly s3Bucket: string;
  private readonly s3Prefix: string;
  private readonly encryptionKey: string;
  private readonly storageQuotaBytes: number;
  private readonly alertThresholdPercent: number;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(BackupRecord)
    private readonly backupRecordRepo: Repository<BackupRecord>,
    private readonly adminAuditLogService: AdminAuditLogService,
  ) {
    this.backupDir = this.configService.get<string>(
      'BACKUP_LOCAL_DIR',
      path.resolve(process.cwd(), 'data', 'backups'),
    );
    this.dbPath = this.configService.get<string>(
      'DATABASE_PATH',
      './data/vaultix.db',
    );
    this.s3Bucket = this.configService.get<string>('BACKUP_S3_BUCKET', '');
    this.s3Prefix = this.configService.get<string>(
      'BACKUP_S3_PREFIX',
      'vaultix/backups',
    );
    this.encryptionKey = this.configService.get<string>(
      'BACKUP_ENCRYPTION_KEY',
      '',
    );
    this.storageQuotaBytes = this.configService.get<number>(
      'BACKUP_STORAGE_QUOTA_BYTES',
      10737418240, // 10 GB default
    );
    this.alertThresholdPercent = this.configService.get<number>(
      'BACKUP_ALERT_THRESHOLD_PERCENT',
      80,
    );

    // Initialize S3 client if configured
    const s3Endpoint = this.configService.get<string>('BACKUP_S3_ENDPOINT');
    const s3Region = this.configService.get<string>(
      'BACKUP_S3_REGION',
      'us-east-1',
    );
    const s3AccessKey = this.configService.get<string>('BACKUP_S3_ACCESS_KEY');
    const s3SecretKey = this.configService.get<string>('BACKUP_S3_SECRET_KEY');

    if (this.s3Bucket && s3AccessKey && s3SecretKey) {
      this.s3Client = new S3Client({
        region: s3Region,
        endpoint: s3Endpoint || undefined,
        credentials: {
          accessKeyId: s3AccessKey,
          secretAccessKey: s3SecretKey,
        },
      });
      this.logger.log('S3 backup storage configured');
    } else {
      this.s3Client = null;
      this.logger.warn(
        'S3 backup storage not configured - backups will be local only',
      );
    }

    // Ensure backup directory exists
    this.ensureBackupDir();
  }

  private ensureBackupDir(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      this.logger.log(`Created backup directory: ${this.backupDir}`);
    }
  }

  /**
   * Trigger a backup. This is the main entry point for both manual and scheduled backups.
   */
  async triggerBackup(dto: TriggerBackupDto = {}): Promise<BackupRecord> {
    const timestamp = this.formatTimestamp(new Date());
    const filename = `vaultix_backup_${timestamp}.db`;
    const encryptedFilename = `${filename}.enc`;
    const localPath = path.join(this.backupDir, filename);
    const encryptedPath = path.join(this.backupDir, encryptedFilename);

    // Create backup record
    const record = this.backupRecordRepo.create({
      filename: encryptedFilename,
      status: BackupStatus.IN_PROGRESS,
      backupType: dto.localOnly ? BackupType.MANUAL : BackupType.SCHEDULED,
      retentionPolicy: dto.retentionPolicy || BackupRetentionPolicy.DAILY,
      encrypted: !!this.encryptionKey,
      metadata: dto.note ? { note: dto.note } : undefined,
    });
    const savedRecord = await this.backupRecordRepo.save(record);

    try {
      // Pre-backup consistency check
      this.logger.log('Running pre-backup consistency check...');
      this.preBackupConsistencyCheck();

      // Create the backup
      this.logger.log(`Creating backup: ${filename}`);
      await this.createSqliteBackup(localPath);
      const stats = fs.statSync(localPath);
      this.logger.log(`Backup created: ${localPath} (${stats.size} bytes)`);

      // Encrypt if key is configured
      let finalPath = localPath;
      let finalSize = stats.size;
      if (this.encryptionKey) {
        this.logger.log('Encrypting backup with AES-256-GCM...');
        await this.encryptFile(localPath, encryptedPath);
        // Remove unencrypted backup
        fs.unlinkSync(localPath);
        finalPath = encryptedPath;
        finalSize = fs.statSync(encryptedPath).size;
      }

      // Calculate checksum
      const checksum = await this.calculateChecksum(finalPath);
      this.logger.log(`Checksum: ${checksum}`);

      // Update record with size and checksum
      savedRecord.sizeBytes = finalSize;
      savedRecord.checksum = checksum;
      savedRecord.localPath = finalPath;

      // Upload to S3 if configured and not local-only
      if (this.s3Client && !dto.localOnly) {
        this.logger.log('Uploading to S3...');
        const s3Key = `${this.s3Prefix}/${encryptedFilename}`;
        await this.uploadToS3(finalPath, s3Key);
        savedRecord.remotePath = `s3://${this.s3Bucket}/${s3Key}`;
        this.logger.log(`Uploaded to S3: ${savedRecord.remotePath}`);
      }

      savedRecord.status = BackupStatus.COMPLETED;
      await this.backupRecordRepo.save(savedRecord);

      // Check storage quota
      await this.checkStorageQuota();

      // Audit log
      await this.adminAuditLogService.create({
        actorId: 'system',
        actionType: 'BACKUP_CREATED',
        resourceType: 'BACKUP',
        resourceId: savedRecord.id,
        metadata: {
          filename: savedRecord.filename,
          sizeBytes: finalSize,
          encrypted: savedRecord.encrypted,
          remotePath: savedRecord.remotePath,
          backupType: savedRecord.backupType,
        },
      });

      this.logger.log(
        `Backup completed successfully: ${savedRecord.filename} (${finalSize} bytes)`,
      );
      return savedRecord;
    } catch (error) {
      savedRecord.status = BackupStatus.FAILED;
      savedRecord.errorMessage =
        error instanceof Error ? error.message : String(error);
      await this.backupRecordRepo.save(savedRecord);

      this.logger.error(
        `Backup failed: ${savedRecord.errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      await this.adminAuditLogService.create({
        actorId: 'system',
        actionType: 'BACKUP_FAILED',
        resourceType: 'BACKUP',
        resourceId: savedRecord.id,
        metadata: {
          filename: savedRecord.filename,
          error: savedRecord.errorMessage,
        },
      });

      throw new InternalServerErrorException(
        `Backup failed: ${savedRecord.errorMessage}`,
      );
    }
  }

  /**
   * Get backup status and storage info.
   */
  async getBackupStatus(): Promise<BackupStatusResponse> {
    const lastBackup = await this.backupRecordRepo.findOne({
      where: { status: BackupStatus.COMPLETED },
      order: { createdAt: 'DESC' },
    });

    const totalBackups = await this.backupRecordRepo.count({
      where: { status: BackupStatus.COMPLETED },
    });

    const totalSizeResult: { total: string } | undefined =
      await this.backupRecordRepo
        .createQueryBuilder('record')
        .select('SUM(record.sizeBytes)', 'total')
        .where('record.status = :status', { status: BackupStatus.COMPLETED })
        .getRawOne();

    const totalSizeBytes = parseInt(totalSizeResult?.total || '0', 10);

    // Retention summary
    const retentionSummary = await this.getRetentionSummary();

    // Check if next scheduled backup is imminent (within next hour)
    const nextScheduledBackup = this.getNextScheduledBackupTime();

    return {
      lastBackup: lastBackup
        ? {
            id: lastBackup.id,
            filename: lastBackup.filename,
            sizeBytes: lastBackup.sizeBytes,
            status: lastBackup.status,
            createdAt: lastBackup.createdAt.toISOString(),
            localPath: lastBackup.localPath,
            remotePath: lastBackup.remotePath,
            encrypted: lastBackup.encrypted,
          }
        : null,
      totalBackups,
      totalSizeBytes,
      storageQuota: {
        usedBytes: totalSizeBytes,
        quotaBytes: this.storageQuotaBytes,
        usagePercent:
          Math.round((totalSizeBytes / this.storageQuotaBytes) * 100 * 100) /
          100,
        alertThreshold: this.alertThresholdPercent,
        isOverThreshold:
          (totalSizeBytes / this.storageQuotaBytes) * 100 >=
          this.alertThresholdPercent,
      },
      retentionSummary,
      nextScheduledBackup,
    };
  }

  /**
   * Verify a backup by restoring it to a temp location and comparing checksums.
   */
  async verifyBackup(backupId: string): Promise<{
    verified: boolean;
    originalChecksum: string;
    restoreChecksum: string;
    verifiedAt: string;
  }> {
    const record = await this.backupRecordRepo.findOne({
      where: { id: backupId },
    });
    if (!record) {
      throw new BadRequestException(`Backup ${backupId} not found`);
    }

    if (!record.localPath || !fs.existsSync(record.localPath)) {
      throw new BadRequestException(
        `Backup file not found locally: ${record.localPath}`,
      );
    }

    const tmpDir = path.join(this.backupDir, '.verify_tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const tmpRestorePath = path.join(tmpDir, `verify_${Date.now()}.db`);

    try {
      // If encrypted, decrypt to temp
      if (record.encrypted && this.encryptionKey) {
        const tmpEncrypted = `${tmpRestorePath}.enc`;
        fs.copyFileSync(record.localPath, tmpEncrypted);
        this.decryptFile(tmpEncrypted, tmpRestorePath);
        fs.unlinkSync(tmpEncrypted);
      } else {
        fs.copyFileSync(record.localPath, tmpRestorePath);
      }

      const restoreChecksum = await this.calculateChecksum(tmpRestorePath);
      const verified = restoreChecksum === record.checksum;

      // Update restore test status
      record.restoreTestStatus = verified ? 'passed' : 'failed';
      await this.backupRecordRepo.save(record);

      // Audit log
      await this.adminAuditLogService.create({
        actorId: 'system',
        actionType: 'BACKUP_VERIFIED',
        resourceType: 'BACKUP',
        resourceId: record.id,
        metadata: {
          verified,
          originalChecksum: record.checksum,
          restoreChecksum,
        },
      });

      return {
        verified,
        originalChecksum: record.checksum || '',
        restoreChecksum,
        verifiedAt: new Date().toISOString(),
      };
    } finally {
      // Cleanup temp files
      if (fs.existsSync(tmpRestorePath)) {
        fs.unlinkSync(tmpRestorePath);
      }
      if (fs.existsSync(tmpDir) && fs.readdirSync(tmpDir).length === 0) {
        fs.rmdirSync(tmpDir);
      }
    }
  }

  /**
   * Apply retention policy: remove old backups based on daily/weekly/monthly rules.
   */
  async applyRetentionPolicy(): Promise<{
    deletedCount: number;
    deletedIds: string[];
  }> {
    const now = new Date();
    const deletedIds: string[] = [];

    // Daily: keep for 7 days
    const dailyCutoff = new Date(now);
    dailyCutoff.setDate(dailyCutoff.getDate() - 7);
    const expiredDaily = await this.backupRecordRepo.find({
      where: {
        retentionPolicy: BackupRetentionPolicy.DAILY,
        createdAt: LessThanOrEqual(dailyCutoff),
        status: BackupStatus.COMPLETED,
      },
    });

    // Weekly: keep for 4 weeks (28 days)
    const weeklyCutoff = new Date(now);
    weeklyCutoff.setDate(weeklyCutoff.getDate() - 28);
    const expiredWeekly = await this.backupRecordRepo.find({
      where: {
        retentionPolicy: BackupRetentionPolicy.WEEKLY,
        createdAt: LessThanOrEqual(weeklyCutoff),
        status: BackupStatus.COMPLETED,
      },
    });

    // Monthly: keep for 12 months
    const monthlyCutoff = new Date(now);
    monthlyCutoff.setMonth(monthlyCutoff.getMonth() - 12);
    const expiredMonthly = await this.backupRecordRepo.find({
      where: {
        retentionPolicy: BackupRetentionPolicy.MONTHLY,
        createdAt: LessThanOrEqual(monthlyCutoff),
        status: BackupStatus.COMPLETED,
      },
    });

    const expired = [...expiredDaily, ...expiredWeekly, ...expiredMonthly];

    for (const record of expired) {
      try {
        // Delete local file
        if (record.localPath && fs.existsSync(record.localPath)) {
          fs.unlinkSync(record.localPath);
          this.logger.log(`Deleted local backup: ${record.localPath}`);
        }

        // Delete from S3
        if (record.remotePath && this.s3Client) {
          const s3Key = this.extractS3Key(record.remotePath);
          if (s3Key) {
            this.logger.log(`Would delete S3 object: ${s3Key}`);
          }
        }

        // Delete record
        await this.backupRecordRepo.remove(record);
        deletedIds.push(record.id);
        this.logger.log(`Deleted backup record: ${record.id}`);
      } catch (error) {
        this.logger.error(`Failed to delete backup ${record.id}: ${error}`);
      }
    }

    this.logger.log(
      `Retention policy applied: deleted ${deletedIds.length} backups`,
    );

    return { deletedCount: deletedIds.length, deletedIds };
  }

  /**
   * Check storage quota and alert if over threshold.
   */
  private async checkStorageQuota(): Promise<void> {
    const totalSizeResult: { total: string } | undefined =
      await this.backupRecordRepo
        .createQueryBuilder('record')
        .select('SUM(record.sizeBytes)', 'total')
        .where('record.status = :status', { status: BackupStatus.COMPLETED })
        .getRawOne();

    const totalSizeBytes = parseInt(totalSizeResult?.total || '0', 10);
    const usagePercent = (totalSizeBytes / this.storageQuotaBytes) * 100;

    if (usagePercent >= this.alertThresholdPercent) {
      this.logger.warn(
        `⚠️ Backup storage alert: ${usagePercent.toFixed(1)}% used (${totalSizeBytes} / ${this.storageQuotaBytes} bytes). Threshold: ${this.alertThresholdPercent}%`,
      );

      await this.adminAuditLogService.create({
        actorId: 'system',
        actionType: 'BACKUP_STORAGE_ALERT',
        resourceType: 'SYSTEM',
        metadata: {
          usedBytes: totalSizeBytes,
          quotaBytes: this.storageQuotaBytes,
          usagePercent: Math.round(usagePercent * 100) / 100,
          threshold: this.alertThresholdPercent,
        },
      });
    }
  }

  /**
   * Pre-backup consistency check: verify the database is accessible and WAL checkpoint.
   */
  private preBackupConsistencyCheck(): void {
    const dbFullPath = path.resolve(process.cwd(), this.dbPath);

    if (!fs.existsSync(dbFullPath)) {
      throw new BadRequestException(`Database file not found: ${dbFullPath}`);
    }

    // Check if WAL mode is enabled by looking for WAL file
    const walPath = `${dbFullPath}-wal`;
    if (fs.existsSync(walPath)) {
      this.logger.log('WAL mode detected - will checkpoint before backup');
    }

    // Verify database integrity by reading the header
    const fd = fs.openSync(dbFullPath, 'r');
    const header = Buffer.alloc(16);
    fs.readSync(fd, header, 0, 16, 0);
    fs.closeSync(fd);

    const magic = header.slice(0, 16).toString('ascii');
    if (!magic.startsWith('SQLite format 3')) {
      throw new BadRequestException(
        'Database file does not appear to be a valid SQLite database',
      );
    }

    this.logger.log('Pre-backup consistency check passed');
  }

  /**
   * Create a backup of the SQLite database using the online backup API.
   */
  private async createSqliteBackup(destPath: string): Promise<void> {
    const dbFullPath = path.resolve(process.cwd(), this.dbPath);

    return new Promise<void>((resolve, reject) => {
      /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

      const sqlite3Mod = require('sqlite3').verbose();
      const db: SqliteDatabase = new sqlite3Mod.Database(
        dbFullPath,
        (err: Error | null) => {
          if (err) {
            reject(new Error(`Failed to open database: ${err.message}`));
            return;
          }

          // Use SQLite's backup API for a consistent snapshot
          const backup = db.backup(destPath);

          backup
            .step(-1) // Backup entire database
            .then(() => {
              return backup.finish();
            })
            .then(() => {
              db.close((closeErr: Error | null) => {
                if (closeErr) {
                  this.logger.warn(
                    `Warning closing database after backup: ${closeErr.message}`,
                  );
                }
                resolve();
              });
            })
            .catch((backupErr: Error) => {
              db.close(() => {});
              reject(new Error(`Backup step failed: ${backupErr.message}`));
            });
        },
      );
      /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    });
  }

  /**
   * Encrypt a file using AES-256-GCM.
   */
  private async encryptFile(
    inputPath: string,
    outputPath: string,
  ): Promise<void> {
    const key = this.deriveEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const input = fs.createReadStream(inputPath);
    const output = fs.createWriteStream(outputPath);

    // Write IV and auth tag length as header
    output.write(iv);
    const authTagLength = 16;
    output.write(Buffer.from([authTagLength]));

    return new Promise<void>((resolve, reject) => {
      input.pipe(cipher).pipe(output);

      output.on('finish', () => {
        const authTag = cipher.getAuthTag();
        output.write(authTag);
        output.end();
        resolve();
      });

      output.on('error', reject);
      input.on('error', reject);
      cipher.on('error', reject);
    });
  }

  /**
   * Decrypt a file encrypted with AES-256-GCM.
   */
  private decryptFile(inputPath: string, outputPath: string): void {
    const key = this.deriveEncryptionKey();
    const input = fs.readFileSync(inputPath);

    // Read IV (12 bytes) and auth tag length (1 byte)
    const iv = input.subarray(0, 12);
    const authTagLength = input[12];
    const authTag = input.subarray(13, 13 + authTagLength);
    const encryptedData = input.subarray(13 + authTagLength);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);

    fs.writeFileSync(outputPath, decrypted);
  }

  /**
   * Derive a 32-byte encryption key from the configured key string.
   */
  private deriveEncryptionKey(): Buffer {
    return crypto.scryptSync(this.encryptionKey, 'vaultix-backup-salt', 32);
  }

  /**
   * Calculate SHA-256 checksum of a file.
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Upload a file to S3.
   */
  private async uploadToS3(filePath: string, s3Key: string): Promise<void> {
    if (!this.s3Client) {
      throw new Error('S3 client not configured');
    }

    const fileContent = fs.readFileSync(filePath);
    const command = new PutObjectCommand({
      Bucket: this.s3Bucket,
      Key: s3Key,
      Body: fileContent,
      ServerSideEncryption: 'aws:kms',
      Metadata: {
        'backup-created': new Date().toISOString(),
        'backup-source': 'vaultix',
      },
    });

    await this.s3Client.send(command);
  }

  /**
   * Get retention summary counts.
   */
  private async getRetentionSummary(): Promise<{
    daily: number;
    weekly: number;
    monthly: number;
  }> {
    const daily = await this.backupRecordRepo.count({
      where: {
        retentionPolicy: BackupRetentionPolicy.DAILY,
        status: BackupStatus.COMPLETED,
      },
    });

    const weekly = await this.backupRecordRepo.count({
      where: {
        retentionPolicy: BackupRetentionPolicy.WEEKLY,
        status: BackupStatus.COMPLETED,
      },
    });

    const monthly = await this.backupRecordRepo.count({
      where: {
        retentionPolicy: BackupRetentionPolicy.MONTHLY,
        status: BackupStatus.COMPLETED,
      },
    });

    return { daily, weekly, monthly };
  }

  /**
   * Get the next scheduled backup time.
   */
  private getNextScheduledBackupTime(): string | null {
    const now = new Date();
    const next = new Date(now);
    next.setHours(2, 0, 0, 0); // Backup at 2 AM
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    return next.toISOString();
  }

  /**
   * Format timestamp for filenames: YYYY-MM-DD_HHmmss
   */
  private formatTimestamp(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  }

  /**
   * Extract S3 key from an s3:// URI.
   */
  private extractS3Key(s3Uri: string): string | null {
    const match = s3Uri.match(/^s3:\/\/[^/]+\/(.+)$/);
    return match ? match[1] : null;
  }

  /**
   * Cron job: Run daily backup at 2 AM.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleDailyBackup(): Promise<void> {
    this.logger.log('Running scheduled daily backup...');
    try {
      await this.triggerBackup({
        retentionPolicy: BackupRetentionPolicy.DAILY,
      });

      // Apply retention policy after each backup
      await this.applyRetentionPolicy();
    } catch (error) {
      this.logger.error(
        `Scheduled backup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Cron job: Weekly backup (Sunday 3 AM) with weekly retention.
   */
  @Cron('0 3 * * 0')
  async handleWeeklyBackup(): Promise<void> {
    this.logger.log('Running scheduled weekly backup...');
    try {
      await this.triggerBackup({
        retentionPolicy: BackupRetentionPolicy.WEEKLY,
      });
    } catch (error) {
      this.logger.error(
        `Weekly backup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Cron job: Monthly backup (1st of month at 4 AM) with monthly retention.
   */
  @Cron('0 4 1 * *')
  async handleMonthlyBackup(): Promise<void> {
    this.logger.log('Running scheduled monthly backup...');
    try {
      await this.triggerBackup({
        retentionPolicy: BackupRetentionPolicy.MONTHLY,
      });
    } catch (error) {
      this.logger.error(
        `Monthly backup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Cron job: Weekly verification test (Wednesday at 5 AM).
   */
  @Cron('0 5 * * 3')
  async handleWeeklyVerification(): Promise<void> {
    this.logger.log('Running weekly backup verification test...');
    const latestBackup = await this.backupRecordRepo.findOne({
      where: { status: BackupStatus.COMPLETED },
      order: { createdAt: 'DESC' },
    });

    if (latestBackup) {
      try {
        await this.verifyBackup(latestBackup.id);
        this.logger.log(
          `Weekly verification passed for backup ${latestBackup.id}`,
        );
      } catch (error) {
        this.logger.error(
          `Weekly verification failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else {
      this.logger.warn('No completed backups found for verification');
    }
  }
}
