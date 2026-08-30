import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Dispute } from '../../escrow/entities/dispute.entity';
import { User } from '../../user/entities/user.entity';

export enum EvidenceStatus {
  PENDING_SCAN = 'pending_scan',
  CLEAN = 'clean',
  INFECTED = 'infected',
  SCAN_FAILED = 'scan_failed',
}

@Entity('dispute_evidence')
@Index(['disputeId'])
@Index(['uploadedById'])
export class DisputeEvidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** FK → disputes.id */
  @Column({ type: 'varchar', length: 36 })
  disputeId: string;

  @ManyToOne(() => Dispute, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'disputeId' })
  dispute: Dispute;

  /** FK → users.id — who uploaded this file */
  @Column({ type: 'varchar', length: 36 })
  uploadedById: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'uploadedById' })
  uploadedBy: User;

  /** UUID-based filename stored on disk (no original name exposed in path) */
  @Column({ type: 'varchar', length: 64 })
  storedFilename: string;

  /** Original filename as submitted by the client (display only) */
  @Column({ type: 'varchar', length: 255 })
  originalFilename: string;

  /** MIME type verified via magic bytes (not client-supplied Content-Type) */
  @Column({ type: 'varchar', length: 128 })
  mimeType: string;

  /** File size in bytes */
  @Column({ type: 'integer' })
  size: number;

  /** Relative path on local storage, e.g. uploads/evidence/<disputeId>/<uuid>.pdf */
  @Column({ type: 'varchar', length: 512 })
  storagePath: string;

  /** Thumbnail path — populated for image types (PNG, JPG, WebP) */
  @Column({ type: 'varchar', length: 512, nullable: true })
  thumbnailPath: string | null;

  /** SHA-256 hex digest of the file contents for integrity checks */
  @Column({ type: 'varchar', length: 64 })
  checksum: string;

  /** ClamAV scan status */
  @Column({
    type: 'varchar',
    length: 32,
    default: EvidenceStatus.PENDING_SCAN,
  })
  scanStatus: EvidenceStatus;

  /** Raw ClamAV verdict string, e.g. "Win.Malware.Eicar-6961992-0 FOUND" */
  @Column({ type: 'text', nullable: true })
  scanResult: string | null;

  /** When the virus scan was last run */
  @Column({ type: 'datetime', nullable: true })
  scannedAt: Date | null;

  /** Soft-delete flag — set by admin DELETE instead of hard removing the row */
  @Column({ type: 'boolean', default: false })
  deleted: boolean;

  /** Who deleted this record (admin userId) */
  @Column({ type: 'varchar', length: 36, nullable: true })
  deletedById: string | null;

  /** When deleted */
  @Column({ type: 'datetime', nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
