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

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}
