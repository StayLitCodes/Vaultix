/**
 * Strongly typed inputs for every Vaultix email template.
 *
 * Templates are presentation-only: they receive fully resolved data
 * (links, names, amounts) and must never fetch data or build URLs from
 * untrusted request input.
 */

/** All supported template names. Used as an allowlist (e.g. preview endpoint). */
export const EMAIL_TEMPLATE_NAMES = [
  'verification',
  'password-reset',
  'escrow-invitation',
  'escrow-status',
  'dispute-filed',
  'dispute-resolved',
  'milestone-release',
] as const;

export type EmailTemplateName = (typeof EMAIL_TEMPLATE_NAMES)[number];

export function isEmailTemplateName(value: unknown): value is EmailTemplateName {
  return (
    typeof value === 'string' &&
    (EMAIL_TEMPLATE_NAMES as readonly string[]).includes(value)
  );
}

/** Final rendered output handed to the email sender (delivery). */
export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface VerificationEmailData {
  userName?: string;
  email: string;
  verificationUrl: string;
}

export interface PasswordResetEmailData {
  userName?: string;
  email: string;
  resetUrl: string;
  /** Human-readable expiry description, e.g. "1 hour". */
  expiresIn?: string;
}

export interface EscrowInvitationEmailData {
  userName?: string;
  escrowTitle: string;
  escrowId: string;
  /** Role the invitee was assigned, e.g. "seller". */
  role?: string;
  amount?: string;
  asset?: string;
  inviterName?: string;
  actionUrl?: string;
  expiresAt?: string;
}

export interface EscrowStatusEmailData {
  userName?: string;
  escrowTitle: string;
  escrowId: string;
  status: string;
  amount?: string;
  asset?: string;
  actionUrl?: string;
  updatedAt?: string;
}

export interface DisputeFiledEmailData {
  userName?: string;
  escrowTitle: string;
  escrowId: string;
  disputeId: string;
  reason?: string;
  filedBy?: string;
  filedAt?: string;
  actionUrl?: string;
}

export interface DisputeResolvedEmailData {
  userName?: string;
  escrowTitle: string;
  escrowId: string;
  disputeId: string;
  outcome?: string;
  resolutionNotes?: string;
  resolvedAt?: string;
  actionUrl?: string;
}

export interface MilestoneReleaseEmailData {
  userName?: string;
  escrowTitle: string;
  escrowId: string;
  milestoneTitle?: string;
  amount?: string;
  asset?: string;
  releasedAt?: string;
  actionUrl?: string;
}

export type EmailTemplateData =
  | VerificationEmailData
  | PasswordResetEmailData
  | EscrowInvitationEmailData
  | EscrowStatusEmailData
  | DisputeFiledEmailData
  | DisputeResolvedEmailData
  | MilestoneReleaseEmailData;
