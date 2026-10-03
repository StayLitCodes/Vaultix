import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum BackupStatus {
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum BackupType {
  SCHEDULED = 'scheduled',
  MANUAL = 'manual',
  VERIFICATION = 'verification',
}

export enum BackupRetentionPolicy {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

@Entity('backup_record')
export class BackupRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 256 })
  filename: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  localPath: string | null;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  remotePath: string | null;

  @Column({ type: 'bigint' })
  sizeBytes: number;

  @Column({ type: 'varchar', length: 32 })
  status: BackupStatus;

  @Column({ type: 'varchar', length: 32 })
  backupType: BackupType;

  @Column({ type: 'varchar', length: 32, default: BackupRetentionPolicy.DAILY })
  retentionPolicy: BackupRetentionPolicy;

  @Column({ type: 'boolean', default: false })
  encrypted: boolean;

  @Column({ type: 'varchar', length: 128, nullable: true })
  checksum: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ type: 'varchar', length: 32, nullable: true })
  restoreTestStatus: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  errorMessage: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
