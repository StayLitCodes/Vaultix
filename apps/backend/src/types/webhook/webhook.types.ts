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
  | 'milestone.released';

export interface WebhookPayload {
  event: WebhookEvent;
  data: unknown;
  timestamp: string;
}
