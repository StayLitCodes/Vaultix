import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationEventType,
} from '../enums/notification-event.enum';
import { NotificationSender } from '../interface/notification-sender.interface';
import { Notification } from '../entities/notification.entity';
import { EmailService } from '../../email/email.service';

// ---------------------------------------------------------------------------
// Branded HTML wrapper helpers
// ---------------------------------------------------------------------------

/** Renders the full branded email HTML with header, content, and footer. */
function wrapHtml(bodyHtml: string, unsubscribeUrl?: string): string {
  const unsubscribeSection = unsubscribeUrl
    ? `<tr>
        <td style="padding:12px 24px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="font-size:12px;color:#9ca3af;margin:0;">
            You received this email because you are a Vaultix member.<br/>
            <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">
              Manage notification preferences
            </a>
          </p>
        </td>
      </tr>`
    : `<tr>
        <td style="padding:12px 24px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="font-size:12px;color:#9ca3af;margin:0;">
            You received this email because you are a Vaultix member.<br/>
            Log in to your account to manage your notification preferences.
          </p>
        </td>
      </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation"
               style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e40af 0%,#1d4ed8 100%);padding:24px 32px;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                🔒 Vaultix
              </h1>
              <p style="margin:4px 0 0;font-size:12px;color:#bfdbfe;">
                Secure Blockchain Escrow
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 24px;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          ${unsubscribeSection}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Appends an unsubscribe/preferences notice to a plain-text email. */
function appendTextFooter(text: string, unsubscribeUrl?: string): string {
  const footer = unsubscribeUrl
    ? `\n\n---\nYou received this email because you are a Vaultix member.\nManage notification preferences: ${unsubscribeUrl}`
    : `\n\n---\nYou received this email because you are a Vaultix member.\nLog in to your account to manage your notification preferences.`;
  return `${text}${footer}`;
}

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
    const unsubscribeUrl = this.readString(payload, 'unsubscribeUrl') ?? undefined;

    const role = this.readString(payload, 'role') ?? 'party';

    const subjects: Record<NotificationEventType, string> = {
      [NotificationEventType.PARTY_INVITED]: `You have been invited to escrow: ${escrowTitle}`,
      [NotificationEventType.PARTY_ACCEPTED]: `Party accepted invitation for escrow ${escrowId}`,
      [NotificationEventType.PARTY_REJECTED]: `Party rejected invitation for escrow ${escrowId}`,
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
      [NotificationEventType.PARTY_INVITED]:
        `You have been invited to participate as ${role} in escrow "${escrowTitle}" (${escrowId}).` +
        this.optionalAmount(amount, asset) +
        (actionUrl ? `` : ' Log in to accept or reject the invitation.'),
      [NotificationEventType.PARTY_ACCEPTED]: `A party has accepted their ${role} invitation for escrow ${escrowId}.`,
      [NotificationEventType.PARTY_REJECTED]: `A party has rejected their ${role} invitation for escrow ${escrowId}.`,
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
    const rawText =
      `${textByEvent[event]}\n\nNotification ID: ${notification.id}${actionLine}`.trim();

    const rawHtmlBody =
      `<p style="font-size:15px;line-height:1.6;color:#374151;">${textByEvent[event]}</p>` +
      (actionUrl
        ? `<p><a href="${actionUrl}"
              style="display:inline-block;background:#1d4ed8;color:#ffffff;padding:10px 20px;
                     border-radius:6px;text-decoration:none;font-weight:600;">
              Review escrow details
           </a></p>`
        : '') +
      `<p style="font-size:12px;color:#9ca3af;margin-top:24px;">Notification ID: ${notification.id}</p>`;

    return {
      subject: subjects[event],
      textBody: appendTextFooter(rawText, unsubscribeUrl),
      htmlBody: wrapHtml(rawHtmlBody, unsubscribeUrl),
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
