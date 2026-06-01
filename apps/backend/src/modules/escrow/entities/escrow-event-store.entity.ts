import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum EscrowEventStoreType {
  CREATED = 'CREATED',
  FUNDED = 'FUNDED',
  CONDITION_FULFILLED = 'CONDITION_FULFILLED',
  CONDITION_CONFIRMED = 'CONDITION_CONFIRMED',
  MILESTONE_RELEASED = 'MILESTONE_RELEASED',
  PARTY_INVITED = 'PARTY_INVITED',
  PARTY_ACCEPTED = 'PARTY_ACCEPTED',
  PARTY_REJECTED = 'PARTY_REJECTED',
  DISPUTE_FILED = 'DISPUTE_FILED',
  DISPUTE_RESOLVED = 'DISPUTE_RESOLVED',
  RELEASED = 'RELEASED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  REFUND_PROCESSED = 'REFUND_PROCESSED',
  EXPIRATION_WARNING = 'EXPIRATION_WARNING',
}

/**
 * Immutable event store for escrow events.
 * This table is append-only — no UPDATE or DELETE operations are allowed.
 * Events can never be modified or deleted once written.
 */
@Entity('escrow_event_store')
@Index('idx_event_store_escrow_id', ['escrowId'])
@Index('idx_event_store_type', ['eventType'])
@Index('idx_event_store_actor', ['actorId'])
@Index('idx_event_store_created_at', ['createdAt'])
@Index('idx_event_store_idempotency', ['idempotencyKey'], { unique: true })
export class EscrowEventStore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'escrow_id' })
  @Index('idx_event_store_escrow_id_2')
  escrowId: string;

  @Column({
    type: 'varchar',
    name: 'event_type',
  })
  eventType: EscrowEventStoreType;

  @Column({ name: 'actor_id', nullable: true })
  actorId?: string;

  @Column({ type: 'jsonb', name: 'payload', nullable: true })
  payload?: Record<string, any>;

  @Column({ name: 'tx_hash', nullable: true })
  txHash?: string;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress?: string;

  @Column({ name: 'idempotency_key', nullable: true, unique: true })
  idempotencyKey?: string;

  @Column({ type: 'int', name: 'event_version', default: 1 })
  eventVersion: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'bigint', name: 'cursor' })
  @Index()
  cursor: string;
}
