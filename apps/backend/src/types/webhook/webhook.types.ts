export type WebhookEvent =
  | 'escrow.created'
  | 'escrow.funded'
  | 'escrow.released'
  | 'escrow.cancelled'
  | 'escrow.disputed'
  | 'escrow.resolved'
  | 'condition.fulfilled'
  | 'condition.confirmed';

export interface WebhookPayload {
  event: WebhookEvent;
  data: unknown;
  timestamp: string;
}
