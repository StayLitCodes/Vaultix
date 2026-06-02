import {
  IPlatformStats,
  IAdminUserResponse,
  IAdminEscrowResponse,
  IAuditLogResponse,
  IAdminEscrowFilters,
  IAuditLogFilters,
  IAdminUser,
  IAdminEscrow,
  IAuditLog,
} from '@/types/admin';

// Mock data for admin dashboard

const MOCK_STATS: IPlatformStats = {
  users: { total: 1284, active: 1102, newLast30Days: 87 },
  escrows: {
    total: 3452,
    active: 412,
    completed: 2891,
    newLast30Days: 198,
    completedLast30Days: 167,
  },
  volume: { totalCompleted: 4285000 },
  roles: { USER: 1240, ADMIN: 38, SUPER_ADMIN: 6 },
};

const MOCK_USERS: IAdminUser[] = Array.from({ length: 50 }, (_, i) => ({
  id: `user-${i + 1}`,
  walletAddress: `G${String.fromCharCode(65 + (i % 26))}${'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.slice(0, 55)}`,
  role: i < 2 ? 'SUPER_ADMIN' as const : i < 6 ? 'ADMIN' as const : 'USER' as const,
  isActive: i !== 7 && i !== 15,
  createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
  updatedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
}));

const ESCROW_STATUSES = ['ACTIVE', 'COMPLETED', 'CANCELLED', 'DISPUTED', 'PENDING'];
const ESCROW_TYPES = ['STANDARD', 'MILESTONE', 'TIMED'];

const MOCK_ADMIN_ESCROWS: IAdminEscrow[] = Array.from({ length: 40 }, (_, i) => ({
  id: `escrow-${i + 1}`,
  title: [
    'Website Development', 'Smart Contract Audit', 'Brand Design Package',
    'API Integration', 'DeFi Protocol Development', 'Mobile App MVP',
    'Content Strategy', 'Security Review', 'Logo & Branding', 'Data Migration',
  ][i % 10],
  description: 'Lorem ipsum dolor sit amet',
  amount: String(Math.floor(Math.random() * 50000) + 100),
  asset: 'XLM',
  status: ESCROW_STATUSES[i % ESCROW_STATUSES.length],
  type: ESCROW_TYPES[i % ESCROW_TYPES.length],
  createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
  updatedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
  expiresAt: new Date(Date.now() + Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(),
  isActive: i % 5 !== 4,
  parties: [
    { id: `p-${i}-1`, userId: `user-${(i % 20) + 1}`, role: 'BUYER', status: 'ACCEPTED' },
    { id: `p-${i}-2`, userId: `user-${(i % 20) + 2}`, role: 'SELLER', status: 'ACCEPTED' },
  ],
}));

const ACTION_TYPES = ['SUSPEND_USER', 'CREATE_ESCROW', 'UPDATE_ESCROW', 'CONSISTENCY_CHECK', 'LOGIN', 'ROLE_CHANGE'];
const RESOURCE_TYPES = ['USER', 'ESCROW', 'SYSTEM'];

const MOCK_AUDIT_LOGS: IAuditLog[] = Array.from({ length: 80 }, (_, i) => ({
  id: `log-${i + 1}`,
  actorId: `user-${(i % 6) + 1}`,
  actionType: ACTION_TYPES[i % ACTION_TYPES.length],
  resourceType: RESOURCE_TYPES[i % RESOURCE_TYPES.length],
  resourceId: i % 3 === 0 ? null : `resource-${i}`,
  metadata: { detail: `Action detail ${i + 1}` },
  createdAt: new Date(Date.now() - i * 3600 * 1000).toISOString(),
}));

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class AdminService {
  static async getStats(): Promise<IPlatformStats> {
    await delay(600);
    return { ...MOCK_STATS };
  }

  static async getUsers(page: number = 1, limit: number = 20, search?: string): Promise<IAdminUserResponse> {
    await delay(500);
    let users = [...MOCK_USERS];

    if (search) {
      const term = search.toLowerCase();
      users = users.filter(u =>
        u.walletAddress.toLowerCase().includes(term) ||
        u.id.toLowerCase().includes(term)
      );
    }

    const total = users.length;
    const start = (page - 1) * limit;
    const paginatedUsers = users.slice(start, start + limit);

    return {
      users: paginatedUsers,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  static async getEscrows(filters: IAdminEscrowFilters = {}): Promise<IAdminEscrowResponse> {
    await delay(500);
    const { status, page = 1, limit = 20 } = filters;
    let escrows = [...MOCK_ADMIN_ESCROWS];

    if (status && status !== 'ALL') {
      escrows = escrows.filter(e => e.status === status);
    }

    const total = escrows.length;
    const start = (page - 1) * limit;
    const paginatedEscrows = escrows.slice(start, start + limit);

    return {
      escrows: paginatedEscrows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  static async getAuditLogs(filters: IAuditLogFilters = {}): Promise<IAuditLogResponse> {
    await delay(500);
    const { actorId, actionType, resourceType, page = 1, pageSize = 20 } = filters;
    let logs = [...MOCK_AUDIT_LOGS];

    if (actorId) logs = logs.filter(l => l.actorId === actorId);
    if (actionType) logs = logs.filter(l => l.actionType === actionType);
    if (resourceType) logs = logs.filter(l => l.resourceType === resourceType);

    const total = logs.length;
    const start = (page - 1) * pageSize;
    const paginatedLogs = logs.slice(start, start + pageSize);

    return { data: paginatedLogs, total };
  }

  static async suspendUser(userId: string): Promise<{ message: string; user: IAdminUser }> {
    await delay(800);
    const user = MOCK_USERS.find(u => u.id === userId);
    if (!user) throw new Error('User not found');
    const updated = { ...user, isActive: !user.isActive };
    return { message: `User ${updated.isActive ? 'unsuspended' : 'suspended'} successfully`, user: updated };
  }

  static async runConsistencyCheck(escrowId: string): Promise<{ status: string; issues: string[] }> {
    await delay(1200);
    return {
      status: 'completed',
      issues: Math.random() > 0.5 ? [] : ['Minor state mismatch detected'],
    };
  }
}
