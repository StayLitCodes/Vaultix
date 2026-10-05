import { EscrowStatusEmailData } from '../email.types';
import { baseLayout, detailRow, greeting, paragraph } from './base-layout';

export function escrowStatusSubject(data: EscrowStatusEmailData): string {
  return `Escrow ${data.status}: ${data.escrowTitle} (${data.escrowId})`;
}

export function escrowStatusHtml(data: EscrowStatusEmailData): string {
  const body =
    greeting(data.userName) +
    paragraph(
      `The status of escrow "${data.escrowTitle}" has changed to "${data.status}".`,
    ) +
    detailRow('Escrow', data.escrowTitle) +
    detailRow('Escrow ID', data.escrowId) +
    detailRow('New status', data.status) +
    (data.amount
      ? detailRow(
          'Amount',
          data.asset ? `${data.amount} ${data.asset}` : data.amount,
        )
      : '') +
    (data.updatedAt ? detailRow('Updated', data.updatedAt) : '');

  return baseLayout({
    preheader: `Escrow "${data.escrowTitle}" is now ${data.status}.`,
    heading: `Escrow ${data.status}`,
    bodyHtml: body,
    cta: data.actionUrl
      ? { label: 'View escrow', url: data.actionUrl }
      : undefined,
    fallbackUrl: data.actionUrl,
  });
}

export function escrowStatusText(data: EscrowStatusEmailData): string {
  const name =
    data.userName && data.userName.trim().length > 0
      ? ` ${data.userName.trim()}`
      : '';
  const lines = [
    `Hi${name},`,
    '',
    `The status of escrow "${data.escrowTitle}" (${data.escrowId}) has changed to "${data.status}".`,
  ];
  if (data.amount) {
    lines.push(`Amount: ${data.amount}${data.asset ? ` ${data.asset}` : ''}.`);
  }
  if (data.updatedAt) {
    lines.push(`Updated: ${data.updatedAt}.`);
  }
  if (data.actionUrl) {
    lines.push('', `Review details: ${data.actionUrl}`);
  }
  return lines.join('\n');
}
