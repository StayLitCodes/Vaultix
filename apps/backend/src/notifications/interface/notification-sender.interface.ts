import { Notification } from '../entities/notification.entity';
import { NotificationChannel } from '../enums/notification-event.enum';

export interface NotificationSender {
  channel: NotificationChannel;
  send(notification: Notification): Promise<void>;
}
