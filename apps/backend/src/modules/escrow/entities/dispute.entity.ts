import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Escrow } from './escrow.entity';
import { User } from '../../user/entities/user.entity';

export enum DisputeStatus {
  OPEN = 'open',
  UNDER_REVIEW = 'under_review',
  RESOLVED = 'resolved',
}

export enum DisputeOutcome {
  RELEASED_TO_SELLER = 'released_to_seller',
  REFUNDED_TO_BUYER = 'refunded_to_buyer',
  SPLIT = 'split',
}

@Entity('disputes')
export class Dispute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  escrowId: string;

  @OneToOne(() => Escrow, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'escrowId' })
  escrow: Escrow;

  @Column()
  filedByUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'filedByUserId' })
  filedBy: User;

  @Column({ type: 'text' })
  reason: string;

  // Stores URLs or reference strings pointing to supporting evidence
  @Column({ type: 'simple-json', nullable: true })
  evidence: string[] | null;

  @Column({ type: 'varchar', default: DisputeStatus.OPEN })
  status: DisputeStatus;

  @Column({ nullable: true })
  resolvedByUserId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'resolvedByUserId' })
  resolvedBy: User | null;

  @Column({ type: 'text', nullable: true })
  resolutionNotes: string | null;

  // Percentage of funds to release to seller (0-100). Required when outcome is SPLIT.
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  sellerPercent: number | null;

  // Percentage of funds to refund to buyer (0-100). Required when outcome is SPLIT.
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  buyerPercent: number | null;

  @Column({ type: 'varchar', nullable: true })
  outcome: DisputeOutcome | null;

  @Column({ type: 'datetime', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
