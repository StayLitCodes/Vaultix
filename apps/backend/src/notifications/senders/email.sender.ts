import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationEventType,
} from '../enums/notification-event.enum';
import { NotificationSender } from '../interface/notification-sender.interface';
import { Notification } from '../entities/notification.entity';
import { EmailService } from '../../email/email.service';

@Injectable()
export class EmailSender implements NotificationSender {
  private readonly logger = new Logger(EmailSender.name);
  channel = NotificationChannel.EMAIL;

  constructor(private readonly emailService: EmailService) {}

  async send(notification: Notification): Promise<void> {
    const to = this.resolveRecipient(notification.payload);
    if (!to) {
      throw new Error(
        `Missing recipient email for notification ${notification.id}`,
      );
    }

    const template = this.templateService.renderFromNotification(
      notification.eventType,
      notification.payload,
    );

    try {
      // Direct send: the notification processor manages its own retries
      await this.emailService.sendEmailNow(
        to,
        template.subject,
        template.htmlBody,
        template.textBody,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send email for notification ${notification.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async sendDirect(
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      await (this.transporter as any).sendMail({
        from: this.fromAddress,
        to,
        subject,
        text,
        html,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send direct email to ${to}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  private resolveRecipient(payload: Record<string, unknown>): string | null {
    const candidateKeys = [
      'email',
      'userEmail',
      'recipientEmail',
      'to',
      'buyerEmail',
      'sellerEmail',
    ];

    for (const key of candidateKeys) {
      const value = payload[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }

    return null;
  }
}
