import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '../enums/notification-event.enum';
import { NotificationSender } from '../interface/notification-sender.interface';
import { Notification } from '../entities/notification.entity';

@Injectable()
export class EmailSender implements NotificationSender {
  channel = NotificationChannel.EMAIL;

  send(notification: Notification): Promise<void> {
    console.log('Sending email:', notification.id);
    return Promise.resolve();
  }
}
