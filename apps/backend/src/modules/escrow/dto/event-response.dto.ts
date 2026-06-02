import { EscrowEventType } from '../entities/escrow-event.entity';

export class EventResponseDto {
  id: string;
  escrowId: string;
  eventType: EscrowEventType;
  actorId?: string;
  data?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: Date;
  cursor: string; // Monotonic cursor for incremental sync

  // Escrow details for context
  escrow?: {
    id: string;
    title: string;
    amount: number;
    assetCode: string;
    assetIssuer?: string;
    status: string;
  };

  // Actor details (wallet address)
  actor?: {
    walletAddress?: string;
  };
}
