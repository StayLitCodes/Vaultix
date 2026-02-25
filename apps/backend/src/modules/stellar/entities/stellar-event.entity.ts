import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

export enum StellarEventType {
  ESCROW_CREATED = 'ESCROW_CREATED',
  ESCROW_FUNDED = 'ESCROW_FUNDED',
  MILESTONE_RELEASED = 'MILESTONE_RELEASED',
  ESCROW_COMPLETED = 'ESCROW_COMPLETED',
  ESCROW_CANCELLED = 'ESCROW_CANCELLED',
  DISPUTE_CREATED = 'DISPUTE_CREATED',
  DISPUTE_RESOLVED = 'DISPUTE_RESOLVED',
}

@Entity('stellar_events')
@Unique(['txHash', 'eventIndex'])
export class StellarEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  @Index()
  txHash: string;

  @Column({ type: 'int' })
  eventIndex: number;

  @Column({
    type: 'enum',
    enum: StellarEventType,
  })
  @Index()
  eventType: StellarEventType;

  @Column({ type: 'varchar', nullable: true })
  escrowId?: string;

  @Column({ type: 'int' })
  @Index()
  ledger: number;

  @Column({ type: 'datetime' })
  @Index()
  timestamp: Date;

  @Column({ type: 'json' })
  rawPayload: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  @Column({ type: 'json', nullable: true })
  extractedFields?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  @CreateDateColumn()
  createdAt: Date;

  // Helper fields for extracted structured data
  @Column({ type: 'decimal', precision: 18, scale: 7, nullable: true })
  amount?: number;

  @Column({ type: 'varchar', nullable: true })
  asset?: string;

  @Column({ type: 'int', nullable: true })
  milestoneIndex?: number;

  @Column({ type: 'varchar', nullable: true })
  fromAddress?: string;

  @Column({ type: 'varchar', nullable: true })
  toAddress?: string;

  @Column({ type: 'text', nullable: true })
  reason?: string;
}
