import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '../enums/notification-event.enum';
import { NotificationSender } from '../interface/notification-sender.interface';
import { Notification } from '../entities/notification.entity';
import { EmailService } from './email.service';

/**
 * EmailSender implements the NotificationSender interface and delegates
 * all delivery logic (templating, queueing, retry, logging) to EmailService.
 */
@Injectable()
export class EmailSender implements NotificationSender {
  channel = NotificationChannel.EMAIL;

  constructor(private readonly emailService: EmailService) {}

  async send(notification: Notification): Promise<void> {
    const result = await this.emailService.enqueue(notification);

    if (!result.success) {
      throw new Error(
        result.error ??
          `EmailService failed to deliver notification ${notification.id}`,
      );
    }
  }
}
