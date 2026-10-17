import { PasswordResetEmailData } from '../email.types';
import { baseLayout, detailRow, greeting, paragraph } from './base-layout';

export function passwordResetSubject(): string {
  return 'Reset your Vaultix password';
}

export function passwordResetHtml(data: PasswordResetEmailData): string {
  const body =
    greeting(data.userName) +
    paragraph(
      'We received a request to reset the password for your Vaultix account.',
    ) +
    detailRow('Account email', data.email) +
    paragraph(
      `This reset link expires in ${data.expiresIn ?? '1 hour'}. If you did not request a password reset, you can safely ignore this email.`,
    );

  return baseLayout({
    preheader: 'Reset your Vaultix password.',
    heading: 'Reset your password',
    bodyHtml: body,
    cta: { label: 'Reset password', url: data.resetUrl },
    fallbackUrl: data.resetUrl,
  });
}

export function passwordResetText(data: PasswordResetEmailData): string {
  const name =
    data.userName && data.userName.trim().length > 0
      ? ` ${data.userName.trim()}`
      : '';
  return (
    `Hi${name},\n\n` +
    `We received a request to reset the password for your Vaultix account.\n\n` +
    `Account email: ${data.email}\n\n` +
    `Open this link to reset your password:\n${data.resetUrl}\n\n` +
    `This link expires in ${data.expiresIn ?? '1 hour'}. ` +
    `If you did not request this, you can safely ignore this email.`
  );
}
