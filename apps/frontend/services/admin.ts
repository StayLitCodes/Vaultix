import {
  IPlatformStats,
  IAdminUserResponse,
  IAdminEscrowResponse,
  IAuditLogResponse,
  IAdminEscrowFilters,
  IAuditLogFilters,
  IAdminUser,
} from '@/types/admin';

// ── Auth helper ────────────────────────────────────────────────────────────
// Swap this out if your token lives somewhere else (e.g. Zustand, cookie, etc.)
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

// ── Base fetch wrapper ─────────────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

class AdminApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'AdminApiError';
  }
}

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    throw new AdminApiError(401, 'Unauthorized — please log in again.');
  }

  if (res.status === 403) {
    throw new AdminApiError(403, 'Access denied — admin role required.');
  }

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      message = body?.message ?? message;
    } catch {
      // ignore parse errors
    }
    throw new AdminApiError(res.status, message);
  }

  return res.json() as Promise<T>;
}

// ── Analytics types ────────────────────────────────────────────────────────

export interface IAnalyticsOverview {
  totalVolume: number;
  totalEscrows: number;
  activeUsers: number;
  completionRate: number;
}

export interface IVolumeDataPoint {
  label: string;
  value: number;
  date?: string;
}

export interface IVolumeAnalytics {
  timeSeries: IVolumeDataPoint[];
  totalVolume: number;
  period: string;
}

export interface IDisputeMetrics {
  total: number;
  rate: number;
  avgResolutionHours: number;
  releasedToSellerPct: number;
  refundedToBuyerPct: number;
}

export interface ITopUser {
  rank: number;
  userId: string;
  walletAddress: string;
  escrowCount: number;
  totalVolume: number;
}

export interface ITopUsersResponse {
  users: ITopUser[];
}

// ── AdminService ───────────────────────────────────────────────────────────

export class AdminService {
  // ── Stats ────────────────────────────────────────────────────────────────

  static async getStats(): Promise<IPlatformStats> {
    return adminFetch<IPlatformStats>('/admin/stats');
  }

  // ── Analytics ────────────────────────────────────────────────────────────

  static async getAnalyticsOverview(): Promise<IAnalyticsOverview> {
    return adminFetch<IAnalyticsOverview>('/admin/analytics/overview');
  }

  static async getVolumeAnalytics(period: '7d' | '30d' | '90d' = '30d'): Promise<IVolumeAnalytics> {
    return adminFetch<IVolumeAnalytics>(`/admin/analytics/volume?period=${period}`);
  }

  static async getDisputeMetrics(): Promise<IDisputeMetrics> {
    return adminFetch<IDisputeMetrics>('/admin/analytics/disputes');
  }

  static async getTopUsers(limit: number = 10): Promise<ITopUsersResponse> {
    return adminFetch<ITopUsersResponse>(`/admin/analytics/top-users?limit=${limit}`);
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  static async getUsers(
    page: number = 1,
    limit: number = 20,
    search?: string,
  ): Promise<IAdminUserResponse> {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(search ? { search } : {}),
    });
    return adminFetch<IAdminUserResponse>(`/admin/users?${params}`);
  }

  static async suspendUser(userId: string): Promise<{ message: string; user: IAdminUser }> {
    return adminFetch<{ message: string; user: IAdminUser }>(
      `/admin/users/${userId}/suspend`,
      { method: 'POST' },
    );
  }

  // ── Escrows ───────────────────────────────────────────────────────────────

  static async getEscrows(filters: IAdminEscrowFilters = {}): Promise<IAdminEscrowResponse> {
    const { status, page = 1, limit = 20 } = filters;
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(status && status !== 'ALL' ? { status } : {}),
    });
    return adminFetch<IAdminEscrowResponse>(`/admin/escrows?${params}`);
  }

  static async runConsistencyCheck(escrowId: string): Promise<{ status: string; issues: string[] }> {
    return adminFetch<{ status: string; issues: string[] }>(
      `/admin/escrows/consistency-check`,
      {
        method: 'POST',
        body: JSON.stringify({ escrowId }),
      },
    );
  }

  // ── Audit Logs ────────────────────────────────────────────────────────────

  static async getAuditLogs(filters: IAuditLogFilters = {}): Promise<IAuditLogResponse> {
    const { actorId, actionType, resourceType, from, to, page = 1, pageSize = 20 } = filters;
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      ...(actorId ? { actorId } : {}),
      ...(actionType ? { actionType } : {}),
      ...(resourceType ? { resourceType } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    });
    return adminFetch<IAuditLogResponse>(`/admin/audit-logs?${params}`);
  }
}

// ── Re-export error class so pages can instanceof-check it ─────────────────
export { AdminApiError };