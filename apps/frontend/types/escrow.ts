export interface IEscrow {
  id: string;
  title: string;
  description: string;
  amount: string;
  asset: string;
  creatorAddress: string;
  counterpartyAddress: string;
  deadline: string;
  status:
    | 'created'
    | 'funded'
    | 'confirmed'
    | 'released'
    | 'completed'
    | 'cancelled'
    | 'disputed'
    | 'expired'
    | 'PENDING'
    | 'ACTIVE'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'DISPUTED'
    | 'EXPIRED';
  createdAt: string;
  updatedAt: string;
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
  role:
    | 'BUYER'
    | 'SELLER'
    | 'ARBITRATOR'
    | 'buyer'
    | 'seller'
    | 'arbitrator';
  status:
    | 'PENDING'
    | 'ACCEPTED'
    | 'REJECTED'
    | 'pending'
    | 'accepted'
    | 'rejected';
  createdAt: string;
}

export interface ICondition {
  id: string;
  escrowId?: string;
  description: string;
  type: string;
  metadata?: Record<string, any>;
  isFulfilled?: boolean;
  fulfilledAt?: string | null;
  fulfilledByUserId?: string | null;
  fulfillmentNotes?: string | null;
  fulfillmentEvidence?: string | null;
  isMet?: boolean;
  metAt?: string | null;
  metByUserId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface IEscrowEvent {
  id: string;
  eventType:
    | 'CREATED'
    | 'PARTY_ADDED'
    | 'PARTY_ACCEPTED'
    | 'PARTY_REJECTED'
    | 'FUNDED'
    | 'CONDITION_MET'
    | 'STATUS_CHANGED'
    | 'UPDATED'
    | 'CANCELLED'
    | 'COMPLETED'
    | 'DISPUTED';
  actorId?: string;
  data?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

export interface IEscrowExtended extends IEscrow {
  type: 'STANDARD' | 'MILESTONE' | 'TIMED' | 'standard' | 'milestone' | 'timed';
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
  refetch: () => Promise<void>;
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

export interface IEscrowEventResponse {
  events: IEscrowEvent[];
  hasNextPage: boolean;
  totalCount: number;
}

export interface IEscrowEventFilters {
  escrowId?: string;
  eventType?: string;
  page?: number;
  limit?: number;
}

// Dispute related interfaces
export interface IDispute {
  id: string;
  escrowId: string;
  filedBy: string;
  reason: string;
  description: string;
  evidenceUrls: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED';
  resolution?: IDisputeResolution;
  createdAt: string;
  updatedAt: string;
}

export interface IDisputeResolution {
  id: string;
  resolvedBy: string;
  outcome: 'RELEASED_TO_SELLER' | 'REFUNDED_TO_BUYER' | 'SPLIT';
  notes?: string;
  splitPercentage?: {
    buyer: number;
    seller: number;
  };
  resolvedAt: string;
}

export interface IDisputeTimeline {
  id: string;
  disputeId: string;
  action: 'FILED' | 'ASSIGNED' | 'UNDER_REVIEW' | 'RESOLVED';
  description: string;
  actorId?: string;
  createdAt: string;
}
