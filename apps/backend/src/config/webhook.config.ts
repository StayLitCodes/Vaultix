import { registerAs } from '@nestjs/config';

// Exponential backoff schedule: 1m, 5m, 30m, 2h, 12h, 24h
const DEFAULT_RETRY_SCHEDULE_MS = [
  60_000, 300_000, 1_800_000, 7_200_000, 43_200_000, 86_400_000,
];

export default registerAs('webhook', () => ({
  maxAttempts: parseInt(process.env.WEBHOOK_MAX_ATTEMPTS || '6', 10),
  retryScheduleMs: process.env.WEBHOOK_RETRY_SCHEDULE_MS
    ? process.env.WEBHOOK_RETRY_SCHEDULE_MS.split(',').map((v) =>
        parseInt(v.trim(), 10),
      )
    : DEFAULT_RETRY_SCHEDULE_MS,
  requestTimeoutMs: parseInt(
    process.env.WEBHOOK_REQUEST_TIMEOUT_MS || '30000',
    10,
  ),
  // Alert when failure rate (%) within the window exceeds this threshold
  alertFailureRateThreshold: parseFloat(
    process.env.WEBHOOK_ALERT_FAILURE_RATE_THRESHOLD || '25',
  ),
  alertMinDeliveries: parseInt(
    process.env.WEBHOOK_ALERT_MIN_DELIVERIES || '10',
    10,
  ),
  alertWindowMinutes: parseInt(
    process.env.WEBHOOK_ALERT_WINDOW_MINUTES || '60',
    10,
  ),
}));
