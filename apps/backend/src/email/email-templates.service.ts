import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DisputeFiledEmailData,
  DisputeResolvedEmailData,
  EmailTemplateData,
  EmailTemplateName,
  EscrowInvitationEmailData,
  EscrowStatusEmailData,
  isEmailTemplateName,
  MilestoneReleaseEmailData,
  PasswordResetEmailData,
  RenderedEmail,
  VerificationEmailData,
} from './email.types';
import {
  disputeFiledHtml,
  disputeFiledSubject,
  disputeFiledText,
} from './templates/dispute-filed.template';
import {
  disputeResolvedHtml,
  disputeResolvedSubject,
  disputeResolvedText,
} from './templates/dispute-resolved.template';
import {
  escrowInvitationHtml,
  escrowInvitationSubject,
  escrowInvitationText,
} from './templates/escrow-invitation.template';
import {
  escrowStatusHtml,
  escrowStatusSubject,
  escrowStatusText,
} from './templates/escrow-status.template';
import {
  milestoneReleaseHtml,
  milestoneReleaseSubject,
  milestoneReleaseText,
} from './templates/milestone-release.template';
import {
  passwordResetHtml,
  passwordResetSubject,
  passwordResetText,
} from './templates/password-reset.template';
import {
  verificationHtml,
  verificationSubject,
  verificationText,
} from './templates/verification.template';

/**
 * Renders branded Vaultix emails (presentation only).
 *
 * Rendering is intentionally separated from delivery: this service produces
 * `{ subject, html, text }` and the existing `EmailService` / notification
 * senders remain responsible for transport, retries and provider config.
 *
 * All dynamic values are HTML-escaped inside the templates; unknown
 * template names are rejected instead of rendered.
 */
@Injectable()
export class EmailTemplatesService {
  renderVerification(data: VerificationEmailData): RenderedEmail {
    this.requireFields(data, ['email', 'verificationUrl']);
    return {
      subject: verificationSubject(),
      html: verificationHtml(data),
      text: verificationText(data),
    };
  }

  renderPasswordReset(data: PasswordResetEmailData): RenderedEmail {
    this.requireFields(data, ['email', 'resetUrl']);
    return {
      subject: passwordResetSubject(),
      html: passwordResetHtml(data),
      text: passwordResetText(data),
    };
  }

  renderEscrowInvitation(data: EscrowInvitationEmailData): RenderedEmail {
    this.requireFields(data, ['escrowTitle', 'escrowId']);
    return {
      subject: escrowInvitationSubject(data),
      html: escrowInvitationHtml(data),
      text: escrowInvitationText(data),
    };
  }

  renderEscrowStatusChange(data: EscrowStatusEmailData): RenderedEmail {
    this.requireFields(data, ['escrowTitle', 'escrowId', 'status']);
    return {
      subject: escrowStatusSubject(data),
      html: escrowStatusHtml(data),
      text: escrowStatusText(data),
    };
  }

  renderDisputeFiled(data: DisputeFiledEmailData): RenderedEmail {
    this.requireFields(data, ['escrowTitle', 'escrowId', 'disputeId']);
    return {
      subject: disputeFiledSubject(data),
      html: disputeFiledHtml(data),
      text: disputeFiledText(data),
    };
  }

  renderDisputeResolved(data: DisputeResolvedEmailData): RenderedEmail {
    this.requireFields(data, ['escrowTitle', 'escrowId', 'disputeId']);
    return {
      subject: disputeResolvedSubject(data),
      html: disputeResolvedHtml(data),
      text: disputeResolvedText(data),
    };
  }

  renderMilestoneRelease(data: MilestoneReleaseEmailData): RenderedEmail {
    this.requireFields(data, ['escrowTitle', 'escrowId']);
    return {
      subject: milestoneReleaseSubject(data),
      html: milestoneReleaseHtml(data),
      text: milestoneReleaseText(data),
    };
  }

  /**
   * Render any supported template by name with its typed data.
   * Throws BadRequestException for unknown template names.
   */
  renderTemplate(
    template: string,
    data: EmailTemplateData,
  ): RenderedEmail {
    if (!isEmailTemplateName(template)) {
      throw new BadRequestException(
        `Unknown email template: ${template}`,
      );
    }
    const name: EmailTemplateName = template;
    switch (name) {
      case 'verification':
        return this.renderVerification(data as VerificationEmailData);
      case 'password-reset':
        return this.renderPasswordReset(data as PasswordResetEmailData);
      case 'escrow-invitation':
        return this.renderEscrowInvitation(data as EscrowInvitationEmailData);
      case 'escrow-status':
        return this.renderEscrowStatusChange(data as EscrowStatusEmailData);
      case 'dispute-filed':
        return this.renderDisputeFiled(data as DisputeFiledEmailData);
      case 'dispute-resolved':
        return this.renderDisputeResolved(data as DisputeResolvedEmailData);
      case 'milestone-release':
        return this.renderMilestoneRelease(data as MilestoneReleaseEmailData);
    }
  }

  /**
   * Synthetic example data for the admin preview endpoint. Never uses
   * production user data or secrets.
   */
  getPreviewData(template: EmailTemplateName): EmailTemplateData {
    switch (template) {
      case 'verification':
        return {
          userName: 'Ada',
          email: 'ada@example.com',
          verificationUrl: 'https://app.vaultix.io/verify-email?token=EXAMPLE',
        };
      case 'password-reset':
        return {
          userName: 'Ada',
          email: 'ada@example.com',
          resetUrl: 'https://app.vaultix.io/reset-password?token=EXAMPLE',
          expiresIn: '1 hour',
        };
      case 'escrow-invitation':
        return {
          userName: 'Ada',
          escrowTitle: 'Website redesign escrow',
          escrowId: 'escrow_123',
          role: 'seller',
          amount: '1,500',
          asset: 'XLM',
          inviterName: 'Bob',
          actionUrl: 'https://app.vaultix.io/escrows/escrow_123',
          expiresAt: '2026-10-01',
        };
      case 'escrow-status':
        return {
          userName: 'Ada',
          escrowTitle: 'Website redesign escrow',
          escrowId: 'escrow_123',
          status: 'funded',
          amount: '1,500',
          asset: 'XLM',
          actionUrl: 'https://app.vaultix.io/escrows/escrow_123',
          updatedAt: '2026-09-24',
        };
      case 'dispute-filed':
        return {
          userName: 'Ada',
          escrowTitle: 'Website redesign escrow',
          escrowId: 'escrow_123',
          disputeId: 'dispute_456',
          reason: 'Deliverables do not match the agreed scope.',
          filedBy: 'Bob',
          filedAt: '2026-09-24',
          actionUrl: 'https://app.vaultix.io/disputes/dispute_456',
        };
      case 'dispute-resolved':
        return {
          userName: 'Ada',
          escrowTitle: 'Website redesign escrow',
          escrowId: 'escrow_123',
          disputeId: 'dispute_456',
          outcome: 'refunded_to_buyer',
          resolutionNotes: 'Funds returned to the buyer in full.',
          resolvedAt: '2026-09-24',
          actionUrl: 'https://app.vaultix.io/disputes/dispute_456',
        };
      case 'milestone-release':
        return {
          userName: 'Ada',
          escrowTitle: 'Website redesign escrow',
          escrowId: 'escrow_123',
          milestoneTitle: 'Homepage delivery',
          amount: '500',
          asset: 'XLM',
          releasedAt: '2026-09-24',
          actionUrl: 'https://app.vaultix.io/escrows/escrow_123',
        };
    }
  }

  /** Render a template with its synthetic preview data. */
  renderPreview(template: EmailTemplateName): RenderedEmail {
    return this.renderTemplate(template, this.getPreviewData(template));
  }

  private requireFields(data: object, fields: string[]): void {
    const record = data as Record<string, unknown>;
    for (const field of fields) {
      const value = record[field];
      if (typeof value !== 'string' || value.trim().length === 0) {
        throw new BadRequestException(
          `Missing required email template field: ${field}`,
        );
      }
    }
  }
}
