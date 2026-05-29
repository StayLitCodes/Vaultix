import {
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Party } from './party.entity';
import { Condition } from './condition.entity';
import { EscrowEvent } from './escrow-event.entity';
import { Dispute } from './dispute.entity';

export enum EscrowStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  DISPUTED = 'disputed',
  EXPIRED = 'expired',
}

export enum EscrowType {
  STANDARD = 'standard',
  MILESTONE = 'milestone',
  TIMED = 'timed',
}

@Entity('escrows')
@Index('idx_escrows_creator', ['creatorId'])
@Index('idx_escrows_status', ['status'])
@Index('idx_escrows_asset', ['assetCode', 'assetIssuer'])
@Index('idx_escrows_created_at', ['createdAt'])
@Index('idx_escrows_expires_at', ['expiresAt'])
@Index('idx_escrows_creator_status_created', [
  'creatorId',
  'status',
  'createdAt',
])
@Index('idx_escrows_dispute_deadline', ['disputeDeadline'])
export class Escrow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'decimal', precision: 18, scale: 7 })
  amount: number;

  @Column({ default: 'XLM', name: 'asset_code' })
  assetCode: string;

  @Column({ nullable: true, name: 'asset_issuer' })
  assetIssuer?: string;

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

  @Column({ nullable: true })
  stellarTxHash?: string;

  @Column({ type: 'datetime', nullable: true })
  fundedAt?: Date;

  @Column({ default: false })
  isReleased: boolean;

  @Column({ type: 'datetime', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  expirationNotifiedAt?: Date;

  @Column({ type: 'datetime', nullable: true, name: 'dispute_deadline' })
  disputeDeadline?: Date;

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

  @Column({ type: 'datetime', nullable: true })
  disputeDeadline?: Date;

  @OneToOne(() => Dispute, (dispute) => dispute.escrow)
  dispute?: Dispute;

  // @OneToMany(() => Milestone, (m) => m.escrow)
  // milestones: Milestone[];
>>>>>>> 589aa69adea7ff0b1b7706d1c0e19a7ffa6ba997
=======
  @Column({ nullable: true })
  metadataHash?: string;

  @OneToOne(() => Dispute, (dispute) => dispute.escrow)
  dispute?: Dispute;

=======
  @Column({ type: 'datetime', nullable: true })
  disputeDeadline?: Date;

  @OneToOne(() => Dispute, (dispute) => dispute.escrow)
  dispute?: Dispute;

  // @OneToMany(() => Milestone, (m) => m.escrow)
  // milestones: Milestone[];
>>>>>>> 589aa69adea7ff0b1b7706d1c0e19a7ffa6ba997

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
