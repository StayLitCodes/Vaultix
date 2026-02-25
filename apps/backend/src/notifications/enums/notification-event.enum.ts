export enum NotificationEventType {
  ESCROW_CREATED = 'ESCROW_CREATED',
  ESCROW_FUNDED = 'ESCROW_FUNDED',
  MILESTONE_RELEASED = 'MILESTONE_RELEASED',
  ESCROW_COMPLETED = 'ESCROW_COMPLETED',
  ESCROW_CANCELLED = 'ESCROW_CANCELLED',
  DISPUTE_RAISED = 'DISPUTE_RAISED',
  DISPUTE_RESOLVED = 'DISPUTE_RESOLVED',
  ESCROW_EXPIRED = 'ESCROW_EXPIRED',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
}

export enum NotificationChannel {
  EMAIL = 'email',
  WEBHOOK = 'webhook',
}
