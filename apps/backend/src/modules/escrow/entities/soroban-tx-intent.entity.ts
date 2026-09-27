import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Operations that can be prepared as a wallet-signable Soroban intent.
 * Each value maps to exactly one contract entrypoint.
 */
export enum SorobanOperation {
  CREATE_ESCROW = 'CREATE_ESCROW',
  DEPOSIT_FUNDS = 'DEPOSIT_FUNDS',
}

export enum SorobanIntentStatus {
  /** Prepared and returned to the client; not yet submitted. */
  PENDING = 'PENDING',
  /** A signed envelope was accepted for broadcast. */
  SUBMITTED = 'SUBMITTED',
  /** Verified against the ledger. */
  CONFIRMED = 'CONFIRMED',
  /** Simulation, broadcast or ledger execution failed. */
  FAILED = 'FAILED',
  /** Past its expiry without a submission. */
  EXPIRED = 'EXPIRED',
}

/**
 * A short-lived, single-use binding between an authenticated user, a specific
 * contract operation, and the unsigned XDR that was handed to the wallet.
 *
 * The server never holds a user secret key: it prepares and simulates, the
 * wallet signs, and the signed envelope comes back for verification. Every
 * column here exists so that a returned signed envelope can only be accepted
 * for the exact user/network/contract/escrow/operation it was prepared for.
 */
@Entity('soroban_tx_intents')
@Index('idx_soroban_intents_escrow', ['escrowId'])
@Index('idx_soroban_intents_user', ['userId'])
@Index('idx_soroban_intents_status_expires', ['status', 'expiresAt'])
export class SorobanTxIntent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Database escrow this intent acts on. */
  @Column()
  escrowId: string;

  /**
   * The u64 the contract uses. The contract takes the escrow id as an explicit
   * argument, so the numeric id must be allocated up front and then frozen
   * into the intent. Stored as a string because u64 exceeds JS safe integers.
   */
  @Column({ type: 'varchar', name: 'on_chain_escrow_id' })
  onChainEscrowId: string;

  @Column()
  userId: string;

  @Column({ type: 'varchar' })
  operation: SorobanOperation;

  /** Source account the wallet must sign as. */
  @Column({ name: 'source_account' })
  sourceAccount: string;

  @Column({ name: 'network_passphrase' })
  networkPassphrase: string;

  @Column({ name: 'contract_id' })
  contractId: string;

  /**
   * SHA-256 over the binding tuple. A returned signed envelope must resolve to
   * an intent whose hash still matches, so tampering with any field is caught.
   */
  @Column({ name: 'intent_hash', unique: true })
  intentHash: string;

  /** Base64 unsigned envelope handed to the wallet. */
  @Column({ type: 'text', name: 'unsigned_xdr' })
  unsignedXdr: string;

  @Column({ type: 'datetime', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'varchar', default: SorobanIntentStatus.PENDING })
  status: SorobanIntentStatus;

  /** Fee in stroops resolved from simulation, for display before signing. */
  @Column({ type: 'bigint', nullable: true, name: 'fee_stroops' })
  feeStroops?: string | null;

  /** Resource fee in stroops reported by the simulation. */
  @Column({
    type: 'bigint',
    nullable: true,
    name: 'resource_fee_stroops',
  })
  resourceFeeStroops?: string | null;

  /** Ledger the simulation was evaluated against. */
  @Column({ type: 'bigint', nullable: true, name: 'simulated_at_ledger' })
  simulatedAtLedger?: string | null;

  /** Hash of the accepted signed envelope; guards duplicate submissions. */
  @Column({ type: 'varchar', nullable: true, name: 'signed_xdr_hash' })
  signedXdrHash?: string | null;

  @Column({ nullable: true })
  txHash?: string | null;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
