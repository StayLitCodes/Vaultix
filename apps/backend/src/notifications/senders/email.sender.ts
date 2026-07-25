import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { NotificationChannel } from '../enums/notification-event.enum';
import { NotificationSender } from '../interface/notification-sender.interface';
import { Notification } from '../entities/notification.entity';
import { EmailTemplateService } from '../services/email-template.service';

@Injectable()
export class EmailSender implements NotificationSender {
  private readonly logger = new Logger(EmailSender.name);
  private readonly transporter: Transporter;
  private readonly fromAddress: string;
  channel = NotificationChannel.EMAIL;

  constructor(
    private readonly configService: ConfigService,
    private readonly templateService: EmailTemplateService,
  ) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<string>('SMTP_PORT', '587'));
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    this.fromAddress = this.configService.get<string>(
      'EMAIL_FROM',
      'no-reply@vaultix.local',
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    this.transporter = createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }

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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      await (this.transporter as any).sendMail({
        from: this.fromAddress,
        to,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
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
