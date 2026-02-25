import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Escrow } from './escrow.entity';

export enum EscrowEventType {
  CREATED = 'created',
  PARTY_ADDED = 'party_added',
  PARTY_ACCEPTED = 'party_accepted',
  PARTY_REJECTED = 'party_rejected',
  FUNDED = 'funded',
  CONDITION_FULFILLED = 'condition_fulfilled',
  CONDITION_MET = 'condition_met',
  STATUS_CHANGED = 'status_changed',
  UPDATED = 'updated',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  DISPUTED = 'disputed',
}

@Entity('escrow_events')
export class EscrowEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  escrowId: string;

  @ManyToOne(() => Escrow, (escrow) => escrow.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'escrowId' })
  escrow: Escrow;

  @Column({
    type: 'varchar',
  })
  eventType: EscrowEventType;

  @Column({ nullable: true })
  actorId?: string;

  @Column({ type: 'simple-json', nullable: true })
  data?: Record<string, any>;

  @Column({ nullable: true })
  ipAddress?: string;

  @CreateDateColumn()
  createdAt: Date;
}
