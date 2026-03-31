export type NotificationChannel = 'email' | 'webhook';

export type NotificationEventType =
  | 'ESCROW_CREATED'
  | 'ESCROW_FUNDED'
  | 'MILESTONE_RELEASED'
  | 'ESCROW_COMPLETED'
  | 'ESCROW_CANCELLED'
  | 'DISPUTE_RAISED'
  | 'DISPUTE_RESOLVED'
  | 'ESCROW_EXPIRED'
  | 'CONDITION_FULFILLED'
  | 'CONDITION_CONFIRMED'
  | 'EXPIRATION_WARNING';

export interface Notification {
  id: string;
  userId: string;
  escrowId?: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'sent' | 'failed';
  readAt: string | null;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  channel: NotificationChannel;
  enabled: boolean;
  eventTypes: NotificationEventType[];
  createdAt: string;
  updatedAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}
