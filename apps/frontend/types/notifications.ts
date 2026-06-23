export enum NotificationEventType {
  ESCROW_CREATED = "ESCROW_CREATED",
  ESCROW_FUNDED = "ESCROW_FUNDED",
  MILESTONE_RELEASED = "MILESTONE_RELEASED",
  DISPUTE_FILED = "DISPUTE_FILED",
  DISPUTE_RESOLVED = "DISPUTE_RESOLVED",
}

export interface IChannelConfig {
  email: boolean;
  webhook: boolean;
}

export interface INotificationPreferences {
  preferences: Record<NotificationEventType, IChannelConfig>;
}

export interface IWebhook {
  id: string;
  url: string;
  eventTypes: NotificationEventType[];
  createdAt: string;
}