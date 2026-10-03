import { registerAs } from '@nestjs/config';

// Registers a "email" namespace in NestJS config; injectable elsewhere via
// ConfigService.get('email.xxx') or @Inject the 'email' token.
export default registerAs('email', () => ({
  // SMTP server hostname; empty string if unset (caller should validate).
  host: process.env.SMTP_HOST || '',
  // SMTP port, defaulting to 587 (standard STARTTLS submission port).
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  // SMTP auth credentials.
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  // Default "From" address used on outgoing emails.
  from: process.env.EMAIL_FROM || 'no-reply@vaultix.local',
  // Max number of send attempts before giving up on an email.
  maxAttempts: parseInt(process.env.EMAIL_MAX_ATTEMPTS || '5', 10),
  retryBaseDelayMs: parseInt(
    process.env.EMAIL_RETRY_BASE_DELAY_MS || '60000',
    10,
  ), // 1 minute base delay, doubled on each retry
  // Base URL used to build email-verification links. Defaults to this
  // API's own verify-email endpoint, derived from API_BASE_URL if the
  // verification URL itself isn't explicitly overridden.
  verificationBaseUrl:
    process.env.EMAIL_VERIFICATION_BASE_URL ||
    `${process.env.API_BASE_URL || 'http://localhost:3000'}/auth/profile/verify-email`,
}));