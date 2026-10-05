// Canonical escrow status enum + normalizer (extends the set introduced for
// #471). The backend enum (apps/backend .../escrow.entity.ts) is the source of
// truth and sends lowercase values: pending, active, completed, cancelled,
// disputed, expired, refunded. This module is the SINGLE normalization
// boundary: API status is converted to a canonical value once, and every
// comparison site (badges, filters, detail actions, counts) imports from here.

export enum CanonicalEscrowStatus {
  CREATED = 'CREATED',
  FUNDED = 'FUNDED',
  ACTIVE = 'ACTIVE',
  DISPUTED = 'DISPUTED',
  RESOLVED = 'RESOLVED',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  // Explicit state for values this build does not recognize (e.g. a status
  // added by a newer backend). Financial actions must never be enabled for it.
  UNKNOWN = 'UNKNOWN',
}

/**
 * Agreed backend mapping: backend status -> canonical status. This is the
 * authoritative mapping applied at the API boundary.
 */
const BACKEND_STATUS_MAP: Record<string, CanonicalEscrowStatus> = {
  // Backend "pending" (awaiting funding) maps to the canonical CREATED state.
  pending: CanonicalEscrowStatus.CREATED,
  created: CanonicalEscrowStatus.CREATED,
  active: CanonicalEscrowStatus.ACTIVE,
  funded: CanonicalEscrowStatus.FUNDED,
  disputed: CanonicalEscrowStatus.DISPUTED,
  resolved: CanonicalEscrowStatus.RESOLVED,
  refunded: CanonicalEscrowStatus.REFUNDED,
  cancelled: CanonicalEscrowStatus.CANCELLED,
  // American spelling is still emitted by some older responses.
  canceled: CanonicalEscrowStatus.CANCELLED,
  completed: CanonicalEscrowStatus.COMPLETED,
  // released is a legacy alias for completed.
  released: CanonicalEscrowStatus.COMPLETED,
  expired: CanonicalEscrowStatus.EXPIRED,
};

const TERMINAL_STATUSES: ReadonlySet<CanonicalEscrowStatus> = new Set([
  CanonicalEscrowStatus.RESOLVED,
  CanonicalEscrowStatus.REFUNDED,
  CanonicalEscrowStatus.CANCELLED,
  CanonicalEscrowStatus.COMPLETED,
  CanonicalEscrowStatus.EXPIRED,
]);

/**
 * Normalizes any known status (backend value or legacy UI alias) to the
 * canonical enum. Unfamiliar/future values become UNKNOWN (never null), so
 * callers never have to special-case a null and financial actions stay gated.
 */
export function normalizeEscrowStatus(raw: string): CanonicalEscrowStatus {
  if (typeof raw !== 'string') {
    return CanonicalEscrowStatus.UNKNOWN;
  }
  const key = raw.trim().toLowerCase();
  if (!key) {
    return CanonicalEscrowStatus.UNKNOWN;
  }
  // Direct canonical member (e.g. already 'ACTIVE').
  const upper = key.toUpperCase();
  if ((Object.values(CanonicalEscrowStatus) as string[]).includes(upper)) {
    return upper as CanonicalEscrowStatus;
  }
  return BACKEND_STATUS_MAP[key] ?? CanonicalEscrowStatus.UNKNOWN;
}

/** True when the status is terminal (no further lifecycle transition). */
export function isTerminalStatus(status: CanonicalEscrowStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/**
 * True when financial actions (fund, release, dispute, cancel) may be offered.
 * UNKNOWN and terminal states never qualify.
 */
export function canTakeFinancialAction(
  status: CanonicalEscrowStatus,
): boolean {
  return (
    !isTerminalStatus(status) && status !== CanonicalEscrowStatus.UNKNOWN
  );
}

/**
 * Inverse of the boundary mapping: canonical status -> the value the backend
 * expects in query filters. UNKNOWN has no backend counterpart and yields
 * undefined so it is never sent as a filter.
 */
const CANONICAL_TO_BACKEND: Partial<Record<CanonicalEscrowStatus, string>> = {
  [CanonicalEscrowStatus.CREATED]: 'pending',
  [CanonicalEscrowStatus.FUNDED]: 'funded',
  [CanonicalEscrowStatus.ACTIVE]: 'active',
  [CanonicalEscrowStatus.DISPUTED]: 'disputed',
  [CanonicalEscrowStatus.RESOLVED]: 'resolved',
  [CanonicalEscrowStatus.REFUNDED]: 'refunded',
  [CanonicalEscrowStatus.CANCELLED]: 'cancelled',
  [CanonicalEscrowStatus.COMPLETED]: 'completed',
  [CanonicalEscrowStatus.EXPIRED]: 'expired',
};

const STATUS_LABELS: Record<CanonicalEscrowStatus, string> = {
  [CanonicalEscrowStatus.CREATED]: 'Pending',
  [CanonicalEscrowStatus.FUNDED]: 'Funded',
  [CanonicalEscrowStatus.ACTIVE]: 'Active',
  [CanonicalEscrowStatus.DISPUTED]: 'Disputed',
  [CanonicalEscrowStatus.RESOLVED]: 'Resolved',
  [CanonicalEscrowStatus.REFUNDED]: 'Refunded',
  [CanonicalEscrowStatus.CANCELLED]: 'Cancelled',
  [CanonicalEscrowStatus.COMPLETED]: 'Completed',
  [CanonicalEscrowStatus.EXPIRED]: 'Expired',
  [CanonicalEscrowStatus.UNKNOWN]: 'Unknown',
};

/** Human-readable label for any canonical status, including EXPIRED/UNKNOWN. */
export function escrowStatusLabel(status: CanonicalEscrowStatus): string {
  return STATUS_LABELS[status] ?? 'Unknown';
}

export function toBackendEscrowStatus(
  status: CanonicalEscrowStatus,
): string | undefined {
  return CANONICAL_TO_BACKEND[status];
}
