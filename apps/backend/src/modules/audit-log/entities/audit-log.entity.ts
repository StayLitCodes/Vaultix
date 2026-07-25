import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AuditAction {
  // Escrow actions
  ESCROW_CREATED = 'escrow.created',
  ESCROW_UPDATED = 'escrow.updated',
  ESCROW_FUNDED = 'escrow.funded',
  ESCROW_CANCELLED = 'escrow.cancelled',
  ESCROW_COMPLETED = 'escrow.completed',
  ESCROW_EXPIRED = 'escrow.expired',
  ESCROW_DISPUTED = 'escrow.disputed',
  ESCROW_DISPUTE_RESOLVED = 'escrow.dispute_resolved',
  MILESTONE_PROPOSED = 'milestone.proposed',
  MILESTONE_ACCEPTED = 'milestone.accepted',
  MILESTONE_RELEASED = 'milestone.released',
  CONDITION_FULFILLED = 'condition.fulfilled',
  CONDITION_CONFIRMED = 'condition.confirmed',
  PARTY_ACCEPTED = 'party.accepted',
  PARTY_REJECTED = 'party.rejected',

  // Admin actions
  USER_SUSPENDED = 'user.suspended',
  USER_ROLE_CHANGED = 'user.role_changed',
  DISPUTE_RESOLVED = 'dispute.resolved',
}

@Entity('audit_logs')
@Index('idx_audit_entity_id', ['entityId'])
@Index('idx_audit_action', ['action'])
@Index('idx_audit_created_at', ['createdAt'])
@Index('idx_audit_entity_action_created', ['entityType', 'entityId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  entityType: string;

  @Column({ type: 'varchar', length: 128 })
  entityId: string;

  @Column({ type: 'varchar', length: 128 })
  action: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  actorId?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  actorRole?: string;

  @Column({ type: 'simple-json', nullable: true })
  previousState?: Record<string, unknown>;

  @Column({ type: 'simple-json', nullable: true })
  newState?: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ipAddress?: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  userAgent?: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}
