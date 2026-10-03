import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export enum EscrowChainIdStatus {
  MAPPED = 'mapped',
  UNMAPPED = 'unmapped',
}

@Entity('escrow_chain_ids')
@Unique('uq_escrow_chain_scope_escrow', ['network', 'contractId', 'escrowId'])
@Unique('uq_escrow_chain_scope_chain_id', [
  'network',
  'contractId',
  'onChainId',
])
@Index('idx_escrow_chain_lookup', ['network', 'contractId', 'onChainId'])
export class EscrowChainId {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32 })
  network: string;

  @Column({ type: 'varchar', length: 56, name: 'contract_id' })
  contractId: string;

  @Column({ type: 'varchar', length: 36, name: 'escrow_id' })
  escrowId: string;

  /** Soroban u64 values stay decimal strings end-to-end. */
  @Column({ type: 'varchar', length: 20, nullable: true, name: 'on_chain_id' })
  onChainId: string | null;

  @Column({
    type: 'varchar',
    length: 16,
    default: EscrowChainIdStatus.UNMAPPED,
  })
  status: EscrowChainIdStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
