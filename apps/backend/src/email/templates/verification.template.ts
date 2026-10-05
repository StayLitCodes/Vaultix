import { VerificationEmailData } from '../email.types';
import { baseLayout, detailRow, greeting, paragraph } from './base-layout';

export function verificationSubject(): string {
  return 'Verify your email address - Vaultix';
}

export function verificationHtml(data: VerificationEmailData): string {
  const body =
    greeting(data.userName) +
    paragraph(
      'Please verify your email address to finish setting up your Vaultix account.',
    ) +
    detailRow('Email', data.email) +
    paragraph('This verification link expires in 24 hours.');

  return baseLayout({
    preheader: 'Verify your Vaultix email address.',
    heading: 'Verify your email address',
    bodyHtml: body,
    cta: { label: 'Verify email address', url: data.verificationUrl },
    fallbackUrl: data.verificationUrl,
  });
}

export function verificationText(data: VerificationEmailData): string {
  const name =
    data.userName && data.userName.trim().length > 0
      ? ` ${data.userName.trim()}`
      : '';
  return (
    `Hi${name},\n\n` +
    `Please verify your email address to finish setting up your Vaultix account.\n\n` +
    `Email: ${data.email}\n\n` +
    `Open this link to verify:\n${data.verificationUrl}\n\n` +
    `This link expires in 24 hours. If you did not request this, you can ignore this email.`
  );
}
