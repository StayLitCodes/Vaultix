import { MilestoneReleaseEmailData } from '../email.types';
import { baseLayout, detailRow, greeting, paragraph } from './base-layout';

export function milestoneReleaseSubject(
  data: MilestoneReleaseEmailData,
): string {
  return `Milestone released for escrow ${data.escrowId}`;
}

export function milestoneReleaseHtml(data: MilestoneReleaseEmailData): string {
  const body =
    greeting(data.userName) +
    paragraph(
      `A milestone has been released for escrow "${data.escrowTitle}".`,
    ) +
    detailRow('Escrow', data.escrowTitle) +
    detailRow('Escrow ID', data.escrowId) +
    (data.milestoneTitle
      ? detailRow('Milestone', data.milestoneTitle)
      : '') +
    (data.amount
      ? detailRow(
          'Released amount',
          data.asset ? `${data.amount} ${data.asset}` : data.amount,
        )
      : '') +
    (data.releasedAt ? detailRow('Released at', data.releasedAt) : '');

  return baseLayout({
    preheader: `A milestone was released for escrow "${data.escrowTitle}".`,
    heading: 'Milestone released',
    bodyHtml: body,
    cta: data.actionUrl
      ? { label: 'View milestone', url: data.actionUrl }
      : undefined,
    fallbackUrl: data.actionUrl,
  });
}

export function milestoneReleaseText(data: MilestoneReleaseEmailData): string {
  const name =
    data.userName && data.userName.trim().length > 0
      ? ` ${data.userName.trim()}`
      : '';
  const lines = [
    `Hi${name},`,
    '',
    `A milestone has been released for escrow "${data.escrowTitle}" (${data.escrowId}).`,
  ];
  if (data.milestoneTitle) lines.push(`Milestone: ${data.milestoneTitle}`);
  if (data.amount) {
    lines.push(
      `Released amount: ${data.amount}${data.asset ? ` ${data.asset}` : ''}.`,
    );
  }
  if (data.releasedAt) lines.push(`Released at: ${data.releasedAt}.`);
  if (data.actionUrl) lines.push('', `Review details: ${data.actionUrl}`);
  return lines.join('\n');
}
