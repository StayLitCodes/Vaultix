import { Injectable } from '@nestjs/common';
import { NotificationEventType } from '../enums/notification-event.enum';
import { Notification } from '../entities/notification.entity';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

interface TemplateVars {
  escrowId: string;
  escrowTitle: string;
  amount: string | null;
  asset: string;
  actionUrl: string | null;
  disputeId: string | null;
  condition: string;
  expiresAt: string | null;
  role: string;
  recipientName: string | null;
  notificationId: string;
}

@Injectable()
export class EmailTemplateService {
  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  build(notification: Notification): EmailTemplate {
    const vars = this.extractVars(notification);
    const event = notification.eventType;

    const subject = this.resolveSubject(event, vars);
    const bodyHtml = this.resolveBodyHtml(event, vars);
    const bodyText = this.resolveBodyText(event, vars);

    return {
      subject,
      html: this.wrapHtml(subject, bodyHtml, vars.actionUrl, vars.notificationId),
      text: this.wrapText(bodyText, vars.actionUrl, vars.notificationId),
    };
  }

  // ---------------------------------------------------------------------------
  // Variable extraction
  // ---------------------------------------------------------------------------

  private extractVars(notification: Notification): TemplateVars {
    const p = notification.payload;
    return {
      escrowId: this.str(p, 'escrowId') ?? 'unknown',
      escrowTitle: this.str(p, 'escrowTitle') ?? 'Escrow',
      amount: this.str(p, 'amount'),
      asset: this.str(p, 'asset') ?? '',
      actionUrl: this.str(p, 'actionUrl'),
      disputeId: this.str(p, 'disputeId'),
      condition: this.str(p, 'condition') ?? 'A condition',
      expiresAt: this.str(p, 'expiresAt'),
      role: this.str(p, 'role') ?? 'party',
      recipientName: this.str(p, 'recipientName') ?? this.str(p, 'name'),
      notificationId: notification.id,
    };
  }

  private str(payload: Record<string, unknown>, key: string): string | null {
    const v = payload[key];
    if (typeof v !== 'string') return null;
    const t = v.trim();
    return t.length > 0 ? t : null;
  }

  // ---------------------------------------------------------------------------
  // Subject lines
  // ---------------------------------------------------------------------------

  private resolveSubject(event: NotificationEventType, v: TemplateVars): string {
    const subjects: Record<NotificationEventType, string> = {
      [NotificationEventType.PARTY_INVITED]:
        `You have been invited to escrow: ${v.escrowTitle}`,
      [NotificationEventType.PARTY_ACCEPTED]:
        `Party accepted invitation for escrow ${v.escrowId}`,
      [NotificationEventType.PARTY_REJECTED]:
        `Party rejected invitation for escrow ${v.escrowId}`,
      [NotificationEventType.ESCROW_CREATED]:
        `Escrow created: ${v.escrowTitle}`,
      [NotificationEventType.ESCROW_FUNDED]:
        `Escrow funded: ${v.escrowTitle}`,
      [NotificationEventType.MILESTONE_RELEASED]:
        `Milestone released for escrow ${v.escrowId}`,
      [NotificationEventType.ESCROW_COMPLETED]:
        `Escrow completed: ${v.escrowTitle}`,
      [NotificationEventType.ESCROW_CANCELLED]:
        `Escrow cancelled: ${v.escrowTitle}`,
      [NotificationEventType.DISPUTE_RAISED]:
        `Dispute filed for escrow ${v.escrowId}`,
      [NotificationEventType.DISPUTE_RESOLVED]:
        `Dispute resolved for escrow ${v.escrowId}`,
      [NotificationEventType.ESCROW_EXPIRED]:
        `Escrow expired: ${v.escrowId}`,
      [NotificationEventType.CONDITION_FULFILLED]:
        `Condition fulfilled for escrow ${v.escrowId}`,
      [NotificationEventType.CONDITION_CONFIRMED]:
        `Condition confirmed for escrow ${v.escrowId}`,
      [NotificationEventType.EXPIRATION_WARNING]:
        `Action required: escrow ${v.escrowId} expires in 24 hours`,
    };
    return subjects[event] ?? `Vaultix notification (${event})`;
  }

  // ---------------------------------------------------------------------------
  // HTML body fragments (no wrapper)
  // ---------------------------------------------------------------------------

  private resolveBodyHtml(event: NotificationEventType, v: TemplateVars): string {
    const amountLine = v.amount
      ? `<p class="detail"><strong>Amount:</strong> ${v.amount} ${v.asset}</p>`
      : '';

    switch (event) {
      case NotificationEventType.PARTY_INVITED:
        return `
          <p>Hi${v.recipientName ? ' ' + this.esc(v.recipientName) : ''},</p>
          <p>You have been invited to participate as <strong>${this.esc(v.role)}</strong>
          in the escrow <strong>&ldquo;${this.esc(v.escrowTitle)}&rdquo;</strong>
          (ID: <code>${this.esc(v.escrowId)}</code>).</p>
          ${amountLine}
          <p>Please review the escrow details and accept or decline the invitation.</p>`;

      case NotificationEventType.PARTY_ACCEPTED:
        return `
          <p>A party has <strong>accepted</strong> their <em>${this.esc(v.role)}</em> invitation
          for escrow <code>${this.esc(v.escrowId)}</code>.</p>
          <p>The escrow is progressing. Log in to review the latest status.</p>`;

      case NotificationEventType.PARTY_REJECTED:
        return `
          <p>A party has <strong>declined</strong> their <em>${this.esc(v.role)}</em> invitation
          for escrow <code>${this.esc(v.escrowId)}</code>.</p>
          <p>You may need to invite a replacement party or cancel the escrow.</p>`;

      case NotificationEventType.ESCROW_CREATED:
        return `
          <p>A new escrow has been created successfully.</p>
          <p class="detail"><strong>Title:</strong> ${this.esc(v.escrowTitle)}</p>
          <p class="detail"><strong>ID:</strong> <code>${this.esc(v.escrowId)}</code></p>
          ${amountLine}
          <p>You can now fund the escrow or invite parties to participate.</p>`;

      case NotificationEventType.ESCROW_FUNDED:
        return `
          <p>Great news &mdash; your escrow has been <strong>funded</strong>.</p>
          <p class="detail"><strong>Escrow:</strong> ${this.esc(v.escrowTitle)}
            (<code>${this.esc(v.escrowId)}</code>)</p>
          ${amountLine}
          <p>All parties can now proceed with the agreed conditions.</p>`;

      case NotificationEventType.MILESTONE_RELEASED:
        return `
          <p>A <strong>milestone has been released</strong> for escrow
          <code>${this.esc(v.escrowId)}</code>.</p>
          ${amountLine}
          <p>Review the milestone details and confirm completion if applicable.</p>`;

      case NotificationEventType.ESCROW_COMPLETED:
        return `
          <p>Escrow <code>${this.esc(v.escrowId)}</code>
          &ldquo;${this.esc(v.escrowTitle)}&rdquo; has been
          <strong>completed successfully</strong>. 🎉</p>
          <p>All conditions have been met and funds have been disbursed.</p>`;

      case NotificationEventType.ESCROW_CANCELLED:
        return `
          <p>Escrow <code>${this.esc(v.escrowId)}</code>
          &ldquo;${this.esc(v.escrowTitle)}&rdquo; has been <strong>cancelled</strong>.</p>
          <p>If this was unexpected, please contact the other parties or raise a dispute.</p>`;

      case NotificationEventType.DISPUTE_RAISED:
        return `
          <p>A <strong>dispute has been filed</strong> for escrow
          <code>${this.esc(v.escrowId)}</code>.</p>
          ${v.disputeId ? `<p class="detail"><strong>Dispute ID:</strong> <code>${this.esc(v.disputeId)}</code></p>` : ''}
          <p>Our dispute resolution team will review the case. Please provide any supporting
          evidence through the platform.</p>`;

      case NotificationEventType.DISPUTE_RESOLVED:
        return `
          <p>The dispute for escrow <code>${this.esc(v.escrowId)}</code> has been
          <strong>resolved</strong>.</p>
          ${v.disputeId ? `<p class="detail"><strong>Dispute ID:</strong> <code>${this.esc(v.disputeId)}</code></p>` : ''}
          <p>Funds will be disbursed according to the resolution. Log in for full details.</p>`;

      case NotificationEventType.ESCROW_EXPIRED:
        return `
          <p>Escrow <code>${this.esc(v.escrowId)}</code> has <strong>expired</strong> without
          being completed.</p>
          <p>Depending on the escrow terms, funds may be returned or held. Please review the
          escrow to understand next steps.</p>`;

      case NotificationEventType.CONDITION_FULFILLED:
        return `
          <p>A condition has been <strong>fulfilled</strong> for escrow
          <code>${this.esc(v.escrowId)}</code>.</p>
          <p class="detail"><strong>Condition:</strong> ${this.esc(v.condition)}</p>
          <p>Please review and confirm this condition to progress the escrow.</p>`;

      case NotificationEventType.CONDITION_CONFIRMED:
        return `
          <p>A condition has been <strong>confirmed</strong> for escrow
          <code>${this.esc(v.escrowId)}</code>.</p>
          <p class="detail"><strong>Condition:</strong> ${this.esc(v.condition)}</p>
          <p>The escrow continues to progress. Log in for the latest status.</p>`;

      case NotificationEventType.EXPIRATION_WARNING:
        return `
          <p>&#x26A0;&#xFE0F; <strong>Your escrow is expiring soon.</strong></p>
          <p>Escrow <code>${this.esc(v.escrowId)}</code> will expire in approximately
          <strong>24 hours</strong>${v.expiresAt ? ` (at ${this.esc(v.expiresAt)})` : ''}.</p>
          <p>Take action now to ensure the escrow is completed before the deadline.</p>`;

      default:
        return `<p>You have a new notification for escrow
          <code>${this.esc(v.escrowId)}</code>. Log in for details.</p>`;
    }
  }

  // ---------------------------------------------------------------------------
  // Plain-text body fragments
  // ---------------------------------------------------------------------------

  private resolveBodyText(event: NotificationEventType, v: TemplateVars): string {
    const amountLine = v.amount ? `Amount: ${v.amount} ${v.asset}\n` : '';

    switch (event) {
      case NotificationEventType.PARTY_INVITED:
        return (
          `You have been invited to participate as ${v.role} in the escrow ` +
          `"${v.escrowTitle}" (ID: ${v.escrowId}).\n${amountLine}` +
          `Please review the escrow details and accept or decline the invitation.`
        );
      case NotificationEventType.PARTY_ACCEPTED:
        return `A party has accepted their ${v.role} invitation for escrow ${v.escrowId}. Log in to review.`;
      case NotificationEventType.PARTY_REJECTED:
        return `A party has declined their ${v.role} invitation for escrow ${v.escrowId}.`;
      case NotificationEventType.ESCROW_CREATED:
        return `A new escrow has been created: "${v.escrowTitle}" (${v.escrowId}).\n${amountLine}You can now fund it or invite parties.`;
      case NotificationEventType.ESCROW_FUNDED:
        return `Escrow "${v.escrowTitle}" (${v.escrowId}) has been funded.\n${amountLine}All parties can now proceed.`;
      case NotificationEventType.MILESTONE_RELEASED:
        return `A milestone has been released for escrow ${v.escrowId}.\n${amountLine}Review and confirm completion.`;
      case NotificationEventType.ESCROW_COMPLETED:
        return `Escrow "${v.escrowTitle}" (${v.escrowId}) has been completed successfully.`;
      case NotificationEventType.ESCROW_CANCELLED:
        return `Escrow "${v.escrowTitle}" (${v.escrowId}) has been cancelled.`;
      case NotificationEventType.DISPUTE_RAISED:
        return (
          `A dispute has been filed for escrow ${v.escrowId}.` +
          (v.disputeId ? ` Dispute ID: ${v.disputeId}.` : '') +
          ` Please provide supporting evidence through the platform.`
        );
      case NotificationEventType.DISPUTE_RESOLVED:
        return (
          `The dispute for escrow ${v.escrowId} has been resolved.` +
          (v.disputeId ? ` Dispute ID: ${v.disputeId}.` : '') +
          ` Log in for full details.`
        );
      case NotificationEventType.ESCROW_EXPIRED:
        return `Escrow ${v.escrowId} has expired. Review the escrow to understand next steps.`;
      case NotificationEventType.CONDITION_FULFILLED:
        return `Condition "${v.condition}" has been fulfilled for escrow ${v.escrowId}. Please confirm to progress the escrow.`;
      case NotificationEventType.CONDITION_CONFIRMED:
        return `Condition "${v.condition}" has been confirmed for escrow ${v.escrowId}.`;
      case NotificationEventType.EXPIRATION_WARNING:
        return (
          `WARNING: Escrow ${v.escrowId} will expire in approximately 24 hours` +
          (v.expiresAt ? ` (at ${v.expiresAt})` : '') +
          `. Take action now.`
        );
      default:
        return `You have a new notification for escrow ${v.escrowId}. Log in for details.`;
    }
  }

  // ---------------------------------------------------------------------------
  // HTML wrapper — branding header + CTA button + unsubscribe footer
  // ---------------------------------------------------------------------------

  private wrapHtml(
    subject: string,
    bodyHtml: string,
    actionUrl: string | null,
    notificationId: string,
  ): string {
    const ctaButton = actionUrl
      ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0;">
          <tr>
            <td align="center">
              <a href="${this.esc(actionUrl)}"
                 style="display:inline-block;background:#7C3AED;color:#fff;
                        font-weight:600;font-size:15px;padding:14px 32px;
                        border-radius:8px;text-decoration:none;">
                View in Vaultix &rarr;
              </a>
            </td>
          </tr>
        </table>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${this.esc(subject)}</title>
  <style>
    body { margin:0; padding:0; background:#F3F4F6; font-family:'Segoe UI',Helvetica,Arial,sans-serif; color:#111827; }
    .wrapper { max-width:600px; margin:32px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.08); }
    .header { background:#7C3AED; padding:28px 32px; text-align:center; }
    .header img { height:36px; }
    .header-title { color:#fff; font-size:22px; font-weight:700; margin:8px 0 0; letter-spacing:.5px; }
    .body { padding:32px; }
    .body p { margin:0 0 16px; line-height:1.65; font-size:15px; color:#374151; }
    .body p.detail { background:#F9FAFB; border-left:3px solid #7C3AED; padding:8px 12px; border-radius:4px; }
    .body code { background:#EDE9FE; color:#5B21B6; padding:2px 6px; border-radius:4px; font-size:13px; }
    .footer { background:#F9FAFB; border-top:1px solid #E5E7EB; padding:20px 32px; text-align:center; font-size:12px; color:#9CA3AF; }
    .footer a { color:#7C3AED; text-decoration:none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <!-- Header / Branding -->
    <div class="header">
      <div class="header-title">&#x1F512; Vaultix</div>
    </div>

    <!-- Body -->
    <div class="body">
      ${bodyHtml}
      ${ctaButton}
    </div>

    <!-- Footer -->
    <div class="footer">
      <p style="margin:0 0 8px;">
        You are receiving this email because you have an active Vaultix account.
      </p>
      <p style="margin:0;">
        <a href="https://vaultix.io/notifications/unsubscribe?nid=${this.esc(notificationId)}">
          Unsubscribe from email notifications
        </a>
        &nbsp;&bull;&nbsp;
        <a href="https://vaultix.io/privacy">Privacy Policy</a>
        &nbsp;&bull;&nbsp;
        <a href="https://vaultix.io">Vaultix</a>
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  // ---------------------------------------------------------------------------
  // Plain-text wrapper
  // ---------------------------------------------------------------------------

  private wrapText(
    bodyText: string,
    actionUrl: string | null,
    notificationId: string,
  ): string {
    const action = actionUrl
      ? `\n\nView details: ${actionUrl}`
      : '';
    const footer =
      `\n\n---\n` +
      `Vaultix | https://vaultix.io\n` +
      `To unsubscribe: https://vaultix.io/notifications/unsubscribe?nid=${notificationId}`;

    return `${bodyText}${action}${footer}`;
  }

  // ---------------------------------------------------------------------------
  // HTML escape helper
  // ---------------------------------------------------------------------------

  private esc(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
