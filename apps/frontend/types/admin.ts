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
