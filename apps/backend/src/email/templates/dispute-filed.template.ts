import { DisputeFiledEmailData } from '../email.types';
import { baseLayout, detailRow, greeting, paragraph } from './base-layout';

export function disputeFiledSubject(data: DisputeFiledEmailData): string {
  return `Dispute filed for escrow ${data.escrowId}`;
}

export function disputeFiledHtml(data: DisputeFiledEmailData): string {
  const body =
    greeting(data.userName) +
    paragraph(
      `A dispute has been filed for escrow "${data.escrowTitle}". Our team will review it and keep all parties updated.`,
    ) +
    detailRow('Escrow', data.escrowTitle) +
    detailRow('Escrow ID', data.escrowId) +
    detailRow('Dispute ID', data.disputeId) +
    (data.reason ? detailRow('Reason', data.reason) : '') +
    (data.filedBy ? detailRow('Filed by', data.filedBy) : '') +
    (data.filedAt ? detailRow('Filed at', data.filedAt) : '');

  return baseLayout({
    preheader: `A dispute was filed for escrow "${data.escrowTitle}".`,
    heading: 'Dispute filed',
    bodyHtml: body,
    cta: data.actionUrl
      ? { label: 'View dispute', url: data.actionUrl }
      : undefined,
    fallbackUrl: data.actionUrl,
  });
}

export function disputeFiledText(data: DisputeFiledEmailData): string {
  const name =
    data.userName && data.userName.trim().length > 0
      ? ` ${data.userName.trim()}`
      : '';
  const lines = [
    `Hi${name},`,
    '',
    `A dispute (${data.disputeId}) has been filed for escrow "${data.escrowTitle}" (${data.escrowId}).`,
  ];
  if (data.reason) lines.push(`Reason: ${data.reason}`);
  if (data.filedBy) lines.push(`Filed by: ${data.filedBy}`);
  if (data.filedAt) lines.push(`Filed at: ${data.filedAt}`);
  if (data.actionUrl) lines.push('', `Review details: ${data.actionUrl}`);
  return lines.join('\n');
}
