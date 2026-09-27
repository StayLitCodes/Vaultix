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
  EXPIRED = 'expired',
  REFUNDED = 'refunded',
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
@Index('IDX_escrows_chainEscrowId', ['chainEscrowId'], { unique: true })
export class Escrow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'decimal', precision: 18, scale: 7 })
  /** SQL decimal amounts remain strings to avoid IEEE-754 loss. */
  amount: string;

  @Column({ type: 'decimal', precision: 18, scale: 7, default: 0 })
  releasedAmount: string;

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

  @Column({ type: 'varchar', nullable: true })
  chainEscrowId?: string;

  @Column({ type: 'datetime', nullable: true })
  fundedAt?: Date;

  /**
   * The u64 the contract uses for this escrow. The contract takes the escrow id
   * as an explicit argument, so this is allocated once when the create intent
   * is prepared and then reused by every later operation. Kept as a string
   * because u64 exceeds the JS safe-integer range.
   */
  @Column({ type: 'varchar', nullable: true, name: 'on_chain_id' })
  onChainId?: string | null;

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

  @Column({ nullable: true })
  metadataHash?: string;

  @Column({ nullable: true, name: 'ipfs_cid' })
  ipfsCid?: string;

  @Column({ nullable: true, name: 'ipfs_metadata_hash' })
  ipfsMetadataHash?: string;

  @Column({ type: 'int', default: 0, name: 'ipfs_version' })
  ipfsVersion?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
