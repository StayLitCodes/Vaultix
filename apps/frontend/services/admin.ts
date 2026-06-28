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
  IAdminDispute,
  IAdminDisputeResponse,
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

const MOCK_DISPUTES: IAdminDispute[] = [
  {
    id: 'dispute-1',
    escrowId: 'escrow-1',
    escrow: {
      id: 'escrow-1',
      title: 'Website Development MVP',
      description: 'Create a next-generation decentralized escrow platform with React, NestJS and Stellar integration.',
      amount: '45000',
      asset: 'XLM',
      status: 'DISPUTED',
      type: 'STANDARD',
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
      parties: [
        { id: 'p-1-1', userId: 'user-1', role: 'BUYER', status: 'ACCEPTED' },
        { id: 'p-1-2', userId: 'user-2', role: 'SELLER', status: 'ACCEPTED' },
      ],
    },
    filedByUserId: 'user-1',
    filedBy: {
      id: 'user-1',
      walletAddress: 'GAX3K2L4PTB56Y3O7G52...B4X2',
    },
    reason: 'The seller did not implement the responsive mobile layout and missed the deadline by 2 weeks. The UI looks broken on iOS and Android devices, which was a core requirement in our specification document.',
    evidence: ['broken_ui_screenshot.png', 'specifications_v1.2.pdf', 'contract_deadline_agreement.pdf'],
    status: 'open',
    createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    resolutionHistory: [
      {
        resolvedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        outcome: 'released_to_seller',
        notes: 'Dispute closed initially after seller claimed they submitted the files, but buyer re-opened indicating files were corrupted.',
        resolvedBy: 'Admin Arbitrator',
      }
    ],
    timeline: [
      { id: 't-1', type: 'ESCROW_CREATED', title: 'Escrow Created', description: 'Escrow initialized by buyer.', timestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), actor: 'Buyer (GAX3...)' },
      { id: 't-2', type: 'ESCROW_FUNDED', title: 'Escrow Funded', description: '45,000 XLM successfully locked in escrow contract.', timestamp: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000).toISOString(), actor: 'Buyer (GAX3...)' },
      { id: 't-3', type: 'DISPUTE_RAISED', title: 'Dispute Filed', description: 'Buyer filed a dispute citing broken UI.', timestamp: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(), actor: 'Buyer (GAX3...)' },
    ],
    communicationLog: [
      { id: 'c-1', sender: 'Buyer (GAX3...)', message: 'Hello, the layout on mobile is completely broken. Buttons overlap and the navigation is unusable.', timestamp: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'c-2', sender: 'Seller (GBK2...)', message: 'I tested it on Chrome DevTools mobile view and it looked fine. Can you send a screenshot?', timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'c-3', sender: 'Buyer (GAX3...)', message: 'Here is the screenshot. The UI breaks on actual iPhone 15 Safari. Please fix it.', timestamp: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'c-4', sender: 'Seller (GBK2...)', message: 'I cannot fix this without extra payment. The specification did not mention Safari compatibility explicitly.', timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() },
    ],
  },
  {
    id: 'dispute-2',
    escrowId: 'escrow-2',
    escrow: {
      id: 'escrow-2',
      title: 'UI/UX Brand Guidelines',
      description: 'Complete branding package including logo, typography, color palette, and business cards.',
      amount: '800',
      asset: 'USDC',
      status: 'DISPUTED',
      type: 'STANDARD',
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
      parties: [
        { id: 'p-2-1', userId: 'user-3', role: 'BUYER', status: 'ACCEPTED' },
        { id: 'p-2-2', userId: 'user-4', role: 'SELLER', status: 'ACCEPTED' },
      ],
    },
    filedByUserId: 'user-4',
    filedBy: {
      id: 'user-4',
      walletAddress: 'GBK2J3L...Y762',
    },
    reason: 'The buyer is refusing to approve release of funds even though all logo assets and style guides were delivered. They are not responding to my messages.',
    evidence: ['final_branding_bundle.zip'],
    status: 'open',
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    timeline: [
      { id: 't-4', type: 'ESCROW_CREATED', title: 'Escrow Created', description: 'Escrow initialized by buyer.', timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), actor: 'Buyer' },
      { id: 't-5', type: 'ESCROW_FUNDED', title: 'Escrow Funded', description: '800 USDC locked.', timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), actor: 'Buyer' },
      { id: 't-6', type: 'DISPUTE_RAISED', title: 'Dispute Filed by Seller', description: 'Seller disputed lack of response.', timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), actor: 'Seller' },
    ],
    communicationLog: [
      { id: 'c-5', sender: 'Seller (GBK2...)', message: 'I have uploaded the final assets. Please review and release the funds.', timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'c-6', sender: 'Seller (GBK2...)', message: 'Are you there? It has been 2 days.', timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
    ],
  },
  {
    id: 'dispute-3',
    escrowId: 'escrow-3',
    escrow: {
      id: 'escrow-3',
      title: 'Article Writing (SEO)',
      description: '3 articles focused on blockchain technology and smart contracts.',
      amount: '150',
      asset: 'XLM',
      status: 'DISPUTED',
      type: 'STANDARD',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
      parties: [
        { id: 'p-3-1', userId: 'user-5', role: 'BUYER', status: 'ACCEPTED' },
        { id: 'p-3-2', userId: 'user-6', role: 'SELLER', status: 'ACCEPTED' },
      ],
    },
    filedByUserId: 'user-5',
    filedBy: {
      id: 'user-5',
      walletAddress: 'GCN3J2L...U829',
    },
    reason: 'The article quality is extremely poor and seems to be fully generated by AI. It lacks depth and does not cover the requested topics.',
    evidence: [],
    status: 'open',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    timeline: [
      { id: 't-7', type: 'ESCROW_CREATED', title: 'Escrow Created', description: 'Escrow initialized.', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), actor: 'Buyer' },
      { id: 't-8', type: 'DISPUTE_RAISED', title: 'Dispute Filed', description: 'Buyer filed dispute for low quality.', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), actor: 'Buyer' },
    ],
    communicationLog: [
      { id: 'c-7', sender: 'Buyer (GCN3...)', message: 'The text is clearly AI-generated. I ran it through an AI detector and it shows 99% probability.', timestamp: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'c-8', sender: 'Seller (GDF8...)', message: 'I wrote this manually. I used Grammarly for proofreading, that is why detector flags it.', timestamp: new Date(Date.now() - 1.2 * 24 * 60 * 60 * 1000).toISOString() },
    ],
  }
];

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

  static async getDisputes(filters: { status?: string; sortBy?: string; page?: number; limit?: number } = {}): Promise<IAdminDisputeResponse> {
    await delay(500);
    const { status = 'all', sortBy = 'oldest', page = 1, limit = 20 } = filters;
    let list = [...MOCK_DISPUTES];
    if (status && status !== 'all') {
      list = list.filter(d => d.status === status);
    }

    if (sortBy === 'oldest') {
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortBy === 'newest') {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === 'most_evidence') {
      list.sort((a, b) => (b.evidence?.length || 0) - (a.evidence?.length || 0));
    } else if (sortBy === 'highest_amount') {
      list.sort((a, b) => parseFloat(b.escrow.amount) - parseFloat(a.escrow.amount));
    }

    const total = list.length;
    const start = (page - 1) * limit;
    const paginated = list.slice(start, start + limit);

    return {
      disputes: paginated,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      }
    };
  }

  static async resolveDispute(
    disputeId: string, 
    data: { outcome: string; resolutionNotes: string; sellerPercent?: number; buyerPercent?: number }
  ): Promise<IAdminDispute> {
    await delay(800);
    const disputeIndex = MOCK_DISPUTES.findIndex(d => d.id === disputeId);
    if (disputeIndex === -1) throw new Error('Dispute not found');

    const dispute = MOCK_DISPUTES[disputeIndex];
    const updated: IAdminDispute = {
      ...dispute,
      status: 'resolved',
      outcome: data.outcome as any,
      resolutionNotes: data.resolutionNotes,
      sellerPercent: data.sellerPercent,
      buyerPercent: data.buyerPercent,
      resolvedAt: new Date().toISOString(),
      escrow: {
        ...dispute.escrow,
        status: data.outcome === 'refunded_to_buyer' ? 'CANCELLED' : 'COMPLETED'
      }
    };

    MOCK_DISPUTES[disputeIndex] = updated;
    return updated;
  }
}
