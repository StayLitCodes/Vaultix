import { EscrowInvitationEmailData } from '../email.types';
import { baseLayout, detailRow, greeting, paragraph } from './base-layout';

function amountLine(data: EscrowInvitationEmailData): string {
  if (!data.amount) return '';
  const asset = data.asset ? ` ${data.asset}` : '';
  return detailRow('Amount', `${data.amount}${asset}`);
}

export function escrowInvitationSubject(
  data: EscrowInvitationEmailData,
): string {
  return `You have been invited to escrow: ${data.escrowTitle}`;
}

export function escrowInvitationHtml(data: EscrowInvitationEmailData): string {
  const role = data.role ? ` as ${data.role}` : '';
  const inviter = data.inviterName ? ` from ${data.inviterName}` : '';
  const body =
    greeting(data.userName) +
    paragraph(
      `You have been invited${inviter} to participate${role} in the escrow "${data.escrowTitle}". Log in to Vaultix to review and accept or reject the invitation.`,
    ) +
    detailRow('Escrow', data.escrowTitle) +
    detailRow('Escrow ID', data.escrowId) +
    (data.role ? detailRow('Your role', data.role) : '') +
    amountLine(data) +
    (data.expiresAt ? detailRow('Invitation expires', data.expiresAt) : '');

  return baseLayout({
    preheader: `You have been invited to escrow "${data.escrowTitle}".`,
    heading: 'Escrow invitation',
    bodyHtml: body,
    cta: data.actionUrl
      ? { label: 'Review invitation', url: data.actionUrl }
      : undefined,
    fallbackUrl: data.actionUrl,
  });
}

export function escrowInvitationText(data: EscrowInvitationEmailData): string {
  const name =
    data.userName && data.userName.trim().length > 0
      ? ` ${data.userName.trim()}`
      : '';
  const lines = [
    `Hi${name},`,
    '',
    `You have been invited${data.inviterName ? ` from ${data.inviterName}` : ''} to participate${data.role ? ` as ${data.role}` : ''} in escrow "${data.escrowTitle}" (${data.escrowId}).`,
  ];
  if (data.amount) {
    lines.push(`Amount: ${data.amount}${data.asset ? ` ${data.asset}` : ''}.`);
  }
  if (data.expiresAt) {
    lines.push(`Invitation expires: ${data.expiresAt}.`);
  }
  lines.push('Log in to Vaultix to accept or reject the invitation.');
  if (data.actionUrl) {
    lines.push('', `Review details: ${data.actionUrl}`);
  }
  return lines.join('\n');
}
