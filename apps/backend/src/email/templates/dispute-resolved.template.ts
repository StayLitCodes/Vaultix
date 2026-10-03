import { DisputeResolvedEmailData } from '../email.types';
import { baseLayout, detailRow, greeting, paragraph } from './base-layout';

export function disputeResolvedSubject(data: DisputeResolvedEmailData): string {
  return `Dispute resolved for escrow ${data.escrowId}`;
}

export function disputeResolvedHtml(data: DisputeResolvedEmailData): string {
  const body =
    greeting(data.userName) +
    paragraph(
      `The dispute for escrow "${data.escrowTitle}" has been resolved.`,
    ) +
    detailRow('Escrow', data.escrowTitle) +
    detailRow('Escrow ID', data.escrowId) +
    detailRow('Dispute ID', data.disputeId) +
    (data.outcome ? detailRow('Outcome', data.outcome) : '') +
    (data.resolutionNotes
      ? detailRow('Resolution notes', data.resolutionNotes)
      : '') +
    (data.resolvedAt ? detailRow('Resolved at', data.resolvedAt) : '');

  return baseLayout({
    preheader: `The dispute for escrow "${data.escrowTitle}" was resolved.`,
    heading: 'Dispute resolved',
    bodyHtml: body,
    cta: data.actionUrl
      ? { label: 'View resolution', url: data.actionUrl }
      : undefined,
    fallbackUrl: data.actionUrl,
  });
}

export function disputeResolvedText(data: DisputeResolvedEmailData): string {
  const name =
    data.userName && data.userName.trim().length > 0
      ? ` ${data.userName.trim()}`
      : '';
  const lines = [
    `Hi${name},`,
    '',
    `Dispute (${data.disputeId}) has been resolved for escrow "${data.escrowTitle}" (${data.escrowId}).`,
  ];
  if (data.outcome) lines.push(`Outcome: ${data.outcome}`);
  if (data.resolutionNotes) lines.push(`Resolution notes: ${data.resolutionNotes}`);
  if (data.resolvedAt) lines.push(`Resolved at: ${data.resolvedAt}`);
  if (data.actionUrl) lines.push('', `Review details: ${data.actionUrl}`);
  return lines.join('\n');
}
