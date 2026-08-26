import { Injectable, Logger } from '@nestjs/common';

interface RateLimitBucket {
  count: number;
  /** Start of the current 1-hour window (ms since epoch). */
  windowStart: number;
}

/**
 * In-memory rate limiter for transactional emails (e.g. verification).
 *
 * Enforces a sliding-window limit of {@link MAX_PER_HOUR} sends per user per
 * hour. The state is intentionally kept in-process — restarting the server
 * resets all counters, which is an acceptable trade-off for the MVP.
 */
@Injectable()
export class EmailRateLimiterService {
  private readonly logger = new Logger(EmailRateLimiterService.name);

  /** Maximum verification emails allowed per user within a 1-hour window. */
  static readonly MAX_PER_HOUR = 3;

  private readonly WINDOW_MS = 60 * 60 * 1_000; // 1 hour in ms

  private readonly buckets = new Map<string, RateLimitBucket>();

  /**
   * Returns `true` if the user is allowed to receive another email right now,
   * and increments their counter. Returns `false` when the limit is exceeded.
   */
  tryConsume(userId: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(userId);

    if (!bucket || now - bucket.windowStart >= this.WINDOW_MS) {
      // New window
      bucket = { count: 0, windowStart: now };
      this.buckets.set(userId, bucket);
    }

    if (bucket.count >= EmailRateLimiterService.MAX_PER_HOUR) {
      const resetInMs = this.WINDOW_MS - (now - bucket.windowStart);
      const resetInMin = Math.ceil(resetInMs / 60_000);
      this.logger.warn(
        `Rate limit exceeded for user ${userId}: ` +
          `${bucket.count}/${EmailRateLimiterService.MAX_PER_HOUR} emails sent. ` +
          `Resets in ~${resetInMin} min.`,
      );
      return false;
    }

    bucket.count += 1;
    this.logger.debug(
      `Rate limit check passed for user ${userId}: ` +
        `${bucket.count}/${EmailRateLimiterService.MAX_PER_HOUR} this hour.`,
    );
    return true;
  }

  /**
   * Returns how many emails the user has sent in the current window.
   * Useful for tests and diagnostics.
   */
  getCurrentCount(userId: string): number {
    const now = Date.now();
    const bucket = this.buckets.get(userId);
    if (!bucket || now - bucket.windowStart >= this.WINDOW_MS) {
      return 0;
    }
    return bucket.count;
  }

  /**
   * Reset the counter for a specific user (test helper).
   */
  reset(userId: string): void {
    this.buckets.delete(userId);
  }
}
