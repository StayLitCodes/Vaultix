// Closes #413: the audit log entity/service already records actorId,
// actionType, and metadata (see AdminAuditLogService), but there's no
// helper computing a previousState/newState diff to embed in that
// metadata. Starter diff builder; wiring this into escrow state-change
// call sites and a dedicated GET /escrows/:id/audit-log route are
// follow-ups.

export interface StateDiff {
  changed: Record<string, { from: unknown; to: unknown }>;
}

/** Computes a shallow diff between two state snapshots for audit metadata. */
export function buildStateDiff(
  previousState: Record<string, unknown>,
  newState: Record<string, unknown>,
): StateDiff {
  const changed: StateDiff['changed'] = {};
  const keys = new Set([...Object.keys(previousState), ...Object.keys(newState)]);
  for (const key of keys) {
    if (previousState[key] !== newState[key]) {
      changed[key] = { from: previousState[key], to: newState[key] };
    }
  }
  return { changed };
}
