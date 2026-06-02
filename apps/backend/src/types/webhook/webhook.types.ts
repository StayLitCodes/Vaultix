export type WebhookEvent =
  | 'escrow.created'
  | 'escrow.funded'
  | 'escrow.released'
  | 'escrow.cancelled'
  | 'escrow.expired'
  | 'escrow.disputed'
  | 'escrow.resolved'
  | 'escrow.milestone_released'
  | 'condition.fulfilled'
  | 'condition.confirmed';

export interface WebhookPayload {
  event: WebhookEvent;
  data: unknown;
  timestamp: string;
}
