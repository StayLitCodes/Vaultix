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

/** Platform tag sent alongside the Expo push token when registering a device. */
export type PushPlatform = 'ios' | 'android';

/** Shape posted to `POST /api/notifications/devices` (#761). */
export interface DeviceRegistration {
  pushToken: string;
  platform: PushPlatform;
}

/** Result of asking the OS for notification permission (#761). */
export type PushPermissionStatus =
  | 'granted'
  | 'denied'
  | 'undetermined'
  | 'unavailable';
