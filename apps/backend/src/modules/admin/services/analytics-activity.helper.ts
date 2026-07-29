// Closes #488: the analytics service already has summary/volume/users/
// disputes/top-users endpoints with caching, but no GET
// /admin/analytics/activity for "recent admin/user actions". Starter
// mapper deriving that feed from AdminAuditLog rows; wiring an actual
// controller route + repository query is a follow-up.
import { AdminAuditLog } from '../entities/admin-audit-log.entity';

export interface RecentActivityItem {
  id: string;
  actorId: string;
  actionType: string;
  resourceType: string;
  resourceId: string | null;
  createdAt: Date;
}

/** Maps raw audit log rows to the shape the activity feed endpoint returns. */
export function toRecentActivityFeed(logs: AdminAuditLog[]): RecentActivityItem[] {
  return logs.map((log) => ({
    id: log.id,
    actorId: log.actorId,
    actionType: log.actionType,
    resourceType: log.resourceType,
    resourceId: log.resourceId ?? null,
    createdAt: log.createdAt,
  }));
}
