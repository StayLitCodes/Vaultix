export type InviteStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export interface EscrowInvite {
  id: string;
  escrowId: string;
  escrowTitle: string;
  amount: string;
  tokenSymbol: string;
  creatorAddress: string;
  inviteToken: string;
  inviteLink: string;
  status: InviteStatus;
  recipientEmail?: string;
  createdAt: string;
  expiresAt: string;
}

export interface CreateInviteResponse {
  inviteToken: string;
  inviteLink: string;
  expiresAt: string;
}
