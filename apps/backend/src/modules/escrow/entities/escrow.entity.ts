import {
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Party } from './party.entity';
import { Condition } from './condition.entity';
import { EscrowEvent } from './escrow-event.entity';

export enum EscrowStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  DISPUTED = 'disputed',
}

export enum EscrowType {
  STANDARD = 'standard',
  MILESTONE = 'milestone',
  TIMED = 'timed',
}

@Entity('escrows')
@Index('idx_escrows_creator', ['creatorId'])
@Index('idx_escrows_status', ['status'])
@Index('idx_escrows_asset', ['asset'])
@Index('idx_escrows_created_at', ['createdAt'])
@Index('idx_escrows_expires_at', ['expiresAt'])
@Index('idx_escrows_creator_status_created', ['creatorId', 'status', 'createdAt'])
export class Escrow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'decimal', precision: 18, scale: 7 })
  amount: number;

  @Column({ default: 'XLM' })
  asset: string;

  @Column({
    type: 'varchar',
    default: EscrowStatus.PENDING,
  })
  status: EscrowStatus;

  @Column({
    type: 'varchar',
    default: EscrowType.STANDARD,
  })
  type: EscrowType;

  @Column()
  creatorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'creatorId' })
  creator: User;

  @Column({ nullable: true })
  releaseTransactionHash?: string;

  @Column({ default: false })
  isReleased: boolean;

  @Column({ type: 'datetime', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  expirationNotifiedAt?: Date;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Party, (party) => party.escrow, { cascade: true })
  parties: Party[];

  @OneToMany(() => Condition, (condition) => condition.escrow, {
    cascade: true,
  })
  conditions: Condition[];

  @OneToMany(() => EscrowEvent, (event) => event.escrow, { cascade: true })
  events: EscrowEvent[];

  // @OneToMany(() => Milestone, (m) => m.escrow)
  // milestones: Milestone[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
