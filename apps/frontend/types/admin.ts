// Admin Dashboard Types

export interface IPlatformStats {
  users: {
    total: number;
    active: number;
    newLast30Days: number;
  };
  escrows: {
    total: number;
    active: number;
    completed: number;
    newLast30Days: number;
    completedLast30Days: number;
  };
  volume: {
    totalCompleted: number;
  };
  roles: Record<string, number>;
}

export interface IAdminUser {
  id: string;
  walletAddress: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IAdminUserResponse {
  users: IAdminUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface IAdminEscrow {
  id: string;
  title: string;
  description: string;
  amount: string;
  asset: string;
  status: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  isActive: boolean;
  parties: {
    id: string;
    userId: string;
    role: string;
    status: string;
  }[];
}

export interface IAdminEscrowResponse {
  escrows: IAdminEscrow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface IAuditLog {
  id: string;
  actorId: string;
  actionType: string;
  resourceType: string;
  resourceId: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface IAuditLogResponse {
  data: IAuditLog[];
  total: number;
}

export interface IAdminEscrowFilters {
  status?: string;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export interface IAuditLogFilters {
  actorId?: string;
  actionType?: string;
  resourceType?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface IAdminDispute {
  id: string;
  escrowId: string;
  escrow: IAdminEscrow;
  filedByUserId: string;
  filedBy: {
    id: string;
    walletAddress: string;
  };
  reason: string;
  evidence: string[] | null;
  status: 'open' | 'under_review' | 'resolved';
  resolvedByUserId?: string | null;
  resolvedBy?: {
    id: string;
    walletAddress: string;
  } | null;
  resolutionNotes?: string | null;
  sellerPercent?: number | null;
  buyerPercent?: number | null;
  outcome?: 'released_to_seller' | 'refunded_to_buyer' | 'split' | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  resolutionHistory?: {
    resolvedAt: string;
    outcome: string;
    notes: string;
    resolvedBy: string;
    sellerPercent?: number;
    buyerPercent?: number;
  }[];
  timeline?: {
    id: string;
    type: string;
    title: string;
    description: string;
    timestamp: string;
    actor: string;
  }[];
  communicationLog?: {
    id: string;
    sender: string;
    message: string;
    timestamp: string;
  }[];
}

export interface IAdminDisputeResponse {
  disputes: IAdminDispute[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
