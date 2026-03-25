import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '../enums/notification-event.enum';
import { NotificationSender } from '../interface/notification-sender.interface';
import { Notification } from '../entities/notification.entity';

@Injectable()
export class WebhookSender implements NotificationSender {
  channel = NotificationChannel.WEBHOOK;

  send(notification: Notification): Promise<void> {
    console.log('Sending webhook:', notification.id);
    return Promise.resolve();
  }
}
