import { IsOptional, IsEnum, IsBoolean, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BackupRetentionPolicy } from '../entities/backup-record.entity';

export class TriggerBackupDto {
  @ApiPropertyOptional({
    description: 'Override retention policy for this backup',
    enum: BackupRetentionPolicy,
  })
  @IsOptional()
  @IsEnum(BackupRetentionPolicy)
  retentionPolicy?: BackupRetentionPolicy;

  @ApiPropertyOptional({
    description: 'Skip S3 upload (local only)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  localOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Optional note for the backup record',
  })
  @IsOptional()
  @IsString()
  note?: string;
}

export interface BackupStatusResponse {
  lastBackup: {
    id: string;
    filename: string;
    sizeBytes: number;
    status: string;
    createdAt: string;
    localPath: string | null;
    remotePath: string | null;
    encrypted: boolean;
  } | null;
  totalBackups: number;
  totalSizeBytes: number;
  storageQuota: {
    usedBytes: number;
    quotaBytes: number;
    usagePercent: number;
    alertThreshold: number;
    isOverThreshold: boolean;
  };
  retentionSummary: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  nextScheduledBackup: string | null;
}

export interface BackupVerificationResult {
  backupId: string;
  verified: boolean;
  originalChecksum: string;
  restoreChecksum: string;
  originalSize: number;
  restoredSize: number;
  verifiedAt: string;
}
