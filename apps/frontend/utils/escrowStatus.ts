// Closes #471: canonical escrow status enum + normalizer. Status values are
// inconsistently lowercase (`created`, `funded`) vs. uppercase (`PENDING`,
// `ACTIVE`) across the frontend. Starter canonical set + mapper; updating
// every comparison site (StatusTabs, EscrowFilters, FilterBadges) to import
// from here is a follow-up.

export enum CanonicalEscrowStatus {
  CREATED = 'CREATED',
  FUNDED = 'FUNDED',
  ACTIVE = 'ACTIVE',
  DISPUTED = 'DISPUTED',
  RESOLVED = 'RESOLVED',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

const LEGACY_ALIASES: Record<string, CanonicalEscrowStatus> = {
  created: CanonicalEscrowStatus.CREATED,
  pending: CanonicalEscrowStatus.CREATED,
  funded: CanonicalEscrowStatus.FUNDED,
  active: CanonicalEscrowStatus.ACTIVE,
  disputed: CanonicalEscrowStatus.DISPUTED,
  resolved: CanonicalEscrowStatus.RESOLVED,
  refunded: CanonicalEscrowStatus.REFUNDED,
  cancelled: CanonicalEscrowStatus.CANCELLED,
  canceled: CanonicalEscrowStatus.CANCELLED,
  completed: CanonicalEscrowStatus.COMPLETED,
};

/** Normalizes any known legacy status casing/spelling to the canonical enum. */
export function normalizeEscrowStatus(raw: string): CanonicalEscrowStatus | null {
  const upper = raw.toUpperCase();
  if ((Object.values(CanonicalEscrowStatus) as string[]).includes(upper)) {
    return upper as CanonicalEscrowStatus;
  }
  return LEGACY_ALIASES[raw.toLowerCase()] ?? null;
}
