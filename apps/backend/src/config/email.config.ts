import { registerAs } from '@nestjs/config';

export default registerAs('email', () => ({
  host: process.env.SMTP_HOST || '',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  from: process.env.EMAIL_FROM || 'no-reply@vaultix.local',
  maxAttempts: parseInt(process.env.EMAIL_MAX_ATTEMPTS || '5', 10),
  retryBaseDelayMs: parseInt(
    process.env.EMAIL_RETRY_BASE_DELAY_MS || '60000',
    10,
  ), // 1 minute base delay, doubled on each retry
  verificationBaseUrl:
    process.env.EMAIL_VERIFICATION_BASE_URL ||
    `${process.env.API_BASE_URL || 'http://localhost:3000'}/auth/profile/verify-email`,
}));
