import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import {
  NotificationChannel,
  NotificationEventType,
} from '../enums/notification-event.enum';
import { NotificationSender } from '../interface/notification-sender.interface';
import { Notification } from '../entities/notification.entity';

@Injectable()
export class EmailSender implements NotificationSender {
  private readonly logger = new Logger(EmailSender.name);
  private readonly transporter: Transporter;
  private readonly fromAddress: string;
  channel = NotificationChannel.EMAIL;

  constructor(private readonly configService: ConfigService) {
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

    const template = this.buildEmailTemplate(notification);

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      await (this.transporter as any).sendMail({
        from: this.fromAddress,
        to,
        subject: template.subject,
        text: template.textBody,
        html: template.htmlBody,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send email for notification ${notification.id}`,
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

  private buildEmailTemplate(notification: Notification): {
    subject: string;
    textBody: string;
    htmlBody: string;
  } {
    const payload = notification.payload;
    const event = notification.eventType;
    const escrowId = this.readString(payload, 'escrowId') ?? 'unknown escrow';
    const escrowTitle = this.readString(payload, 'escrowTitle') ?? 'Escrow';
    const amount = this.readString(payload, 'amount');
    const asset = this.readString(payload, 'asset') ?? 'asset';
    const actionUrl = this.readString(payload, 'actionUrl');
    const disputeId = this.readString(payload, 'disputeId');
    const condition = this.readString(payload, 'condition') ?? 'A condition';
    const expiresAt = this.readString(payload, 'expiresAt');

    const subjects: Record<NotificationEventType, string> = {
      [NotificationEventType.ESCROW_CREATED]: `Escrow created: ${escrowTitle} (${escrowId})`,
      [NotificationEventType.ESCROW_FUNDED]: `Escrow funded: ${escrowTitle} (${escrowId})`,
      [NotificationEventType.MILESTONE_RELEASED]: `Milestone released for escrow ${escrowId}`,
      [NotificationEventType.ESCROW_COMPLETED]: `Escrow completed: ${escrowTitle} (${escrowId})`,
      [NotificationEventType.ESCROW_CANCELLED]: `Escrow cancelled: ${escrowTitle} (${escrowId})`,
      [NotificationEventType.DISPUTE_RAISED]: `Dispute filed for escrow ${escrowId}`,
      [NotificationEventType.DISPUTE_RESOLVED]: `Dispute resolved for escrow ${escrowId}`,
      [NotificationEventType.ESCROW_EXPIRED]: `Escrow expired: ${escrowId}`,
      [NotificationEventType.CONDITION_FULFILLED]: `Condition fulfilled for escrow ${escrowId}`,
      [NotificationEventType.CONDITION_CONFIRMED]: `Condition confirmed for escrow ${escrowId}`,
      [NotificationEventType.EXPIRATION_WARNING]: `Escrow expiring in 24h: ${escrowId}`,
    };

    const textByEvent: Record<NotificationEventType, string> = {
      [NotificationEventType.ESCROW_CREATED]:
        `A new escrow (${escrowId}) has been created.` +
        this.optionalAmount(amount, asset),
      [NotificationEventType.ESCROW_FUNDED]:
        `Escrow ${escrowId} has been funded.` +
        this.optionalAmount(amount, asset),
      [NotificationEventType.MILESTONE_RELEASED]: `A milestone has been released for escrow ${escrowId}.`,
      [NotificationEventType.ESCROW_COMPLETED]: `Escrow ${escrowId} is now completed.`,
      [NotificationEventType.ESCROW_CANCELLED]: `Escrow ${escrowId} has been cancelled.`,
      [NotificationEventType.DISPUTE_RAISED]: `A dispute (${disputeId ?? 'unknown'}) has been filed for escrow ${escrowId}.`,
      [NotificationEventType.DISPUTE_RESOLVED]: `Dispute (${disputeId ?? 'unknown'}) has been resolved for escrow ${escrowId}.`,
      [NotificationEventType.ESCROW_EXPIRED]: `Escrow ${escrowId} has expired.`,
      [NotificationEventType.CONDITION_FULFILLED]: `${condition} has been fulfilled for escrow ${escrowId}.`,
      [NotificationEventType.CONDITION_CONFIRMED]: `${condition} has been confirmed for escrow ${escrowId}.`,
      [NotificationEventType.EXPIRATION_WARNING]:
        `Escrow ${escrowId} will expire in approximately 24 hours` +
        (expiresAt ? ` (at ${expiresAt}).` : '.'),
    };

    const actionLine = actionUrl ? `\n\nReview details: ${actionUrl}` : '';
    const textBody =
      `${textByEvent[event]}\n\nNotification ID: ${notification.id}${actionLine}`.trim();
    const htmlBody =
      `<p>${textByEvent[event]}</p>` +
      (actionUrl
        ? `<p><a href="${actionUrl}">Review escrow details</a></p>`
        : '') +
      `<p><small>Notification ID: ${notification.id}</small></p>`;

    return {
      subject: subjects[event],
      textBody,
      htmlBody,
    };
  }

  private readString(payload: Record<string, unknown>, key: string) {
    const value = payload[key];
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private optionalAmount(amount: string | null, asset: string): string {
    if (!amount) return '';
    return ` Amount: ${amount} ${asset}.`;
  }
}
