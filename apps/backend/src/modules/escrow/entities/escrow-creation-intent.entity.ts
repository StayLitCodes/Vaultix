import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum EscrowCreationIntentStatus {
  PREPARED = 'prepared',
  SUBMITTED = 'submitted',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

@Entity('escrow_creation_intents')
export class EscrowCreationIntent {
  @PrimaryColumn({ type: 'varchar', length: 80 })
  id: string;

  @Column()
  creatorId: string;

  @Column()
  sourceAddress: string;

  @Column()
  chainEscrowId: string;

  @Column({ type: 'simple-json' })
  payload: Record<string, unknown>;

  @Column({ type: 'text' })
  unsignedXdr: string;

  @Column({ nullable: true })
  transactionHash?: string;

  @Column({ nullable: true })
  escrowId?: string;

  @Column({ type: 'varchar', default: EscrowCreationIntentStatus.PREPARED })
  status: EscrowCreationIntentStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
