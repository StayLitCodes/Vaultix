import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationEventType,
} from '../enums/notification-event.enum';
import { NotificationSender } from '../interface/notification-sender.interface';
import { Notification } from '../entities/notification.entity';
import { EmailService } from '../../email/email.service';
import { EmailTemplatesService } from '../../email/email-templates.service';
import { RenderedEmail } from '../../email/email.types';

@Injectable()
export class EmailSender implements NotificationSender {
  private readonly logger = new Logger(EmailSender.name);
  channel = NotificationChannel.EMAIL;

  constructor(
    private readonly emailService: EmailService,
    private readonly emailTemplatesService: EmailTemplatesService,
  ) {}

  async send(notification: Notification): Promise<void> {
    const to = this.resolveRecipient(notification.payload);
    if (!to) {
      throw new Error(
        `Missing recipient email for notification ${notification.id}`,
      );
    }

    const template = this.buildEmailTemplate(notification);

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
    const rendered = this.renderBrandedTemplate(notification);
    return {
      subject: rendered.subject,
      textBody: rendered.text,
      htmlBody: rendered.html,
    };
  }

  /**
   * Map notification events onto the branded Vaultix templates.
   * Invitations, disputes and milestone releases have dedicated templates;
   * all other escrow lifecycle events share the generic status template.
   */
  private renderBrandedTemplate(notification: Notification): RenderedEmail {
    const payload = notification.payload;
    const event = notification.eventType;
    const escrowId = this.readString(payload, 'escrowId') ?? 'unknown escrow';
    const escrowTitle = this.readString(payload, 'escrowTitle') ?? 'Escrow';
    const amount = this.readString(payload, 'amount') ?? undefined;
    const asset = this.readString(payload, 'asset') ?? undefined;
    const actionUrl = this.readString(payload, 'actionUrl') ?? undefined;

    switch (event) {
      case NotificationEventType.PARTY_INVITED:
        return this.emailTemplatesService.renderEscrowInvitation({
          escrowTitle,
          escrowId,
          role: this.readString(payload, 'role') ?? undefined,
          amount,
          asset,
          actionUrl,
          expiresAt: this.readString(payload, 'expiresAt') ?? undefined,
        });
      case NotificationEventType.DISPUTE_RAISED:
        return this.emailTemplatesService.renderDisputeFiled({
          escrowTitle,
          escrowId,
          disputeId: this.readString(payload, 'disputeId') ?? 'unknown',
          reason: this.readString(payload, 'reason') ?? undefined,
          actionUrl,
        });
      case NotificationEventType.DISPUTE_RESOLVED:
        return this.emailTemplatesService.renderDisputeResolved({
          escrowTitle,
          escrowId,
          disputeId: this.readString(payload, 'disputeId') ?? 'unknown',
          outcome: this.readString(payload, 'outcome') ?? undefined,
          resolutionNotes:
            this.readString(payload, 'resolutionNotes') ?? undefined,
          actionUrl,
        });
      case NotificationEventType.MILESTONE_RELEASED:
        return this.emailTemplatesService.renderMilestoneRelease({
          escrowTitle,
          escrowId,
          milestoneTitle:
            this.readString(payload, 'milestoneTitle') ??
            this.readString(payload, 'condition') ??
            undefined,
          amount,
          asset,
          actionUrl,
        });
      default:
        return this.emailTemplatesService.renderEscrowStatusChange({
          escrowTitle,
          escrowId,
          status: this.statusLabel(event, payload),
          amount,
          asset,
          actionUrl,
          updatedAt: this.readString(payload, 'expiresAt') ?? undefined,
        });
    }
  }

  /** Human-readable status label for the generic escrow-status template. */
  private statusLabel(
    event: NotificationEventType,
    payload: Record<string, unknown>,
  ): string {
    const labels: Partial<Record<NotificationEventType, string>> = {
      [NotificationEventType.PARTY_ACCEPTED]: 'invitation accepted',
      [NotificationEventType.PARTY_REJECTED]: 'invitation rejected',
      [NotificationEventType.ESCROW_CREATED]: 'created',
      [NotificationEventType.ESCROW_FUNDED]: 'funded',
      [NotificationEventType.ESCROW_COMPLETED]: 'completed',
      [NotificationEventType.ESCROW_CANCELLED]: 'cancelled',
      [NotificationEventType.ESCROW_EXPIRED]: 'expired',
      [NotificationEventType.CONDITION_FULFILLED]: 'condition fulfilled',
      [NotificationEventType.CONDITION_CONFIRMED]: 'condition confirmed',
      [NotificationEventType.EXPIRATION_WARNING]: 'expiring soon',
    };
    const fallback =
      this.readString(payload, 'status') ?? String(event).toLowerCase();
    return labels[event] ?? fallback.replace(/_/g, ' ');
  }
  private readString(payload: Record<string, unknown>, key: string) {
    const value = payload[key];
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
