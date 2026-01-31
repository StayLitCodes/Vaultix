export interface IEscrow {
  id: string;
  title: string;
  description: string;
  amount: string;
  asset: string;
  creatorAddress: string;
  counterpartyAddress: string;
  deadline: string; // ISO date string
  status: 'created' | 'funded' | 'confirmed' | 'released' | 'completed' | 'cancelled' | 'disputed' | 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  milestones?: Array<{
    id: string;
    title: string;
    amount: string;
    status: 'pending' | 'released';
  }>;
}

export interface IParty {
  id: string;
  userId: string;
  role: 'BUYER' | 'SELLER' | 'ARBITRATOR';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
}

export interface ICondition {
  id: string;
  description: string;
  type: string;
  metadata?: Record<string, any>;
}

export interface IEscrowEvent {
  id: string;
  eventType: 'CREATED' | 'PARTY_ADDED' | 'PARTY_ACCEPTED' | 'PARTY_REJECTED' | 'FUNDED' | 'CONDITION_MET' | 'STATUS_CHANGED' | 'UPDATED' | 'CANCELLED' | 'COMPLETED' | 'DISPUTED';
  actorId?: string;
  data?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

// Extended IEscrow interface to match backend entities
export interface IEscrowExtended extends IEscrow {
  type: 'STANDARD' | 'MILESTONE' | 'TIMED';
  creatorId: string;
  expiresAt?: string;
  isActive: boolean;
  creator: {
    id: string;
    walletAddress?: string;
  };
  parties: IParty[];
  conditions: ICondition[];
  events: IEscrowEvent[];
}

export interface IUseEscrowReturn {
  escrow: IEscrowExtended | null;
  loading: boolean;
  error: string | null;
}

export interface IWalletHookReturn {
  connected: boolean;
  publicKey: string | null;
  connect: () => void;
}

export interface IEscrowResponse {
  escrows: IEscrow[];
  hasNextPage: boolean;
  totalPages?: number;
  totalCount?: number;
}

export interface IEscrowFilters {
  status?: 'all' | 'active' | 'pending' | 'completed' | 'disputed';
  search?: string;
  sortBy?: 'date' | 'amount' | 'deadline';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}