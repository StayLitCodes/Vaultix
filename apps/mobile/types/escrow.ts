/**
 * Escrow and milestone status types aligned with the on-chain contract enums.
 *
 * See docs/STATUS_MAPPING.md for the full cross-layer mapping table,
 * state-transition graph, and documented aliases.
 */

/**
 * All possible escrow states as understood by the Soroban contract.
 *
 * Contract → mobile mapping:
 * - `Created`   → `'created'`
 * - `Active`    → `'funded'` (mobile alias — see STATUS_MAPPING.md)
 * - `Active`    → `'active'` (backend may send either; handle both)
 * - `Completed` → `'completed'`
 * - `Cancelled` → `'cancelled'`
 * - `Disputed`  → `'disputed'`
 * - `Resolved`  → `'resolved'`  (previously missing — added per #558)
 * - `Expired`   → `'expired'`
 *
 * `'confirmed'` is a client-only transient alias for `Active` used while
 * waiting for the FundsDeposited indexer event after a deposit tx lands.
 */
export type EscrowStatus =
  | 'created'
  | 'funded'      // mobile alias for contract `Active` — see STATUS_MAPPING.md
  | 'active'      // canonical backend value for contract `Active`
  | 'confirmed'   // client-only transient: deposit tx confirmed, indexer not yet updated
  | 'released'
  | 'completed'
  | 'cancelled'
  | 'disputed'
  | 'resolved'    // added: maps to contract `Resolved` — fixes #558
  | 'expired';

/**
 * All possible milestone states as understood by the Soroban contract.
 *
 * Contract → mobile mapping:
 * - `Pending`  → `'pending'`
 * - `Released` → `'released'`
 * - `Disputed` → `'disputed'`  (previously missing — added per #558)
 */
export type MilestoneStatus =
  | 'pending'
  | 'released'
  | 'disputed';  // added: maps to contract `MilestoneStatus::Disputed` — fixes #558

export type UserRole = 'depositor' | 'recipient' | 'arbitrator';

export interface Milestone {
  id: string;
  title: string;
  amount: string;
  status: MilestoneStatus;
  description?: string;
}

export interface Party {
  id: string;
  userId: string;
  walletAddress: string;
  role: UserRole;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface EscrowEvent {
  id: string;
  eventType: string;
  actorId?: string;
  createdAt: string;
  data?: Record<string, unknown>;
}

export interface Escrow {
  id: string;
  title: string;
  description: string;
  amount: string;
  asset: string;
  creatorAddress: string;
  counterpartyAddress: string;
  deadline: string;
  status: EscrowStatus;
  createdAt: string;
  updatedAt: string;
  milestones?: Milestone[];
  parties?: Party[];
  events?: EscrowEvent[];
}

export interface EscrowListResponse {
  escrows: Escrow[];
  hasNextPage: boolean;
  totalCount: number;
  totalPages: number;
}

export interface EscrowFilters {
  status?: EscrowStatus | 'all';
  page?: number;
  limit?: number;
  search?: string;
}

export interface CreateEscrowPayload {
  title: string;
  description: string;
  counterpartyAddress: string;
  amount: string;
  asset: string;
  deadline: string;
  milestones: Array<{ title: string; amount: string; description?: string }>;
}

export interface ReleaseMilestonePayload {
  escrowId: string;
  milestoneId: string;
}

export type TxStatus = 'idle' | 'submitting' | 'submitted' | 'confirmed' | 'failed';

export interface TxState {
  status: TxStatus;
  txHash?: string;
  error?: string;
}

/**
 * Returns a human-readable label for every escrow status.
 * Use this instead of ad-hoc switch statements so new statuses are
 * handled consistently across screens.
 */
export function escrowStatusLabel(status: EscrowStatus): string {
  switch (status) {
    case 'created':   return 'Awaiting Deposit';
    case 'funded':
    case 'active':    return 'In Progress';
    case 'confirmed': return 'Confirming…';
    case 'released':  return 'Released';
    case 'completed': return 'Completed';
    case 'cancelled': return 'Cancelled';
    case 'disputed':  return 'Disputed';
    case 'resolved':  return 'Resolved';
    case 'expired':   return 'Expired';
  }
}

/**
 * Returns a human-readable label for every milestone status.
 */
export function milestoneStatusLabel(status: MilestoneStatus): string {
  switch (status) {
    case 'pending':   return 'Pending';
    case 'released':  return 'Released';
    case 'disputed':  return 'Disputed';
  }
}

/**
 * Returns true if the escrow is in a terminal state (no further transitions possible).
 */
export function isTerminalEscrowStatus(status: EscrowStatus): boolean {
  return status === 'completed' || status === 'cancelled' || status === 'resolved' || status === 'expired';
}
