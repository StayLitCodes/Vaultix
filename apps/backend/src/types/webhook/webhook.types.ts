export type WebhookEvent =
  | 'escrow.created'
  | 'escrow.funded'
  | 'escrow.released'
  | 'escrow.cancelled'
  | 'escrow.expired'
  | 'escrow.disputed'
  | 'escrow.resolved'
  | 'condition.fulfilled'
  | 'condition.confirmed'
  | 'milestone.released'
  | 'party.invited'
  | 'party.accepted'
  | 'party.rejected'
  | 'escrow.refund_processed'
  | 'escrow.expiration_warning';

export interface WebhookPayload {
  event: WebhookEvent;
  data: unknown;
  timestamp: string;
}
