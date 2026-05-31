export type EscrowStatus =
  | 'created'
  | 'funded'
  | 'confirmed'
  | 'released'
  | 'completed'
  | 'cancelled'
  | 'disputed'
  | 'expired';

export type MilestoneStatus = 'pending' | 'released';

export type UserRole = 'depositor' | 'recipient' | 'arbitrator';

export interface Milestone {
  id: string;
  title: string;
  amount: string;
  status: MilestoneStatus;
  description?: string;
}

export interface Party {
  id: string;
  userId: string;
  walletAddress: string;
  role: UserRole;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface EscrowEvent {
  id: string;
  eventType: string;
  actorId?: string;
  createdAt: string;
  data?: Record<string, unknown>;
}

export interface Escrow {
  id: string;
  title: string;
  description: string;
  amount: string;
  asset: string;
  creatorAddress: string;
  counterpartyAddress: string;
  deadline: string;
  status: EscrowStatus;
  createdAt: string;
  updatedAt: string;
  milestones?: Milestone[];
  parties?: Party[];
  events?: EscrowEvent[];
}

export interface EscrowListResponse {
  escrows: Escrow[];
  hasNextPage: boolean;
  totalCount: number;
  totalPages: number;
}

export interface EscrowFilters {
  status?: EscrowStatus | 'all';
  page?: number;
  limit?: number;
  search?: string;
}

export interface CreateEscrowPayload {
  title: string;
  description: string;
  counterpartyAddress: string;
  amount: string;
  asset: string;
  deadline: string;
  milestones: Array<{ title: string; amount: string; description?: string }>;
}

export interface ReleaseMilestonePayload {
  escrowId: string;
  milestoneId: string;
}

export type TxStatus = 'idle' | 'submitting' | 'submitted' | 'confirmed' | 'failed';

export interface TxState {
  status: TxStatus;
  txHash?: string;
  error?: string;
}
