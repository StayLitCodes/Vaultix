import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

/**
 * Upload-specific rate limiter: 20 uploads per hour per authenticated user.
 *
 * Uses an in-process Map with sliding-window semantics.
 * For multi-process deployments this should be backed by Redis, but for the
 * current single-process SQLite setup this is sufficient.
 */
@Injectable()
export class UploadRateLimitGuard implements CanActivate {
  private static readonly WINDOW_MS = 60 * 60 * 1000; // 1 hour
  private static readonly MAX_UPLOADS = 20;

  /** userId → { count, windowStart } */
  private readonly store = new Map<string, RateLimitEntry>();

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: { sub?: string; userId?: string } }>();

    const userId = req.user?.sub ?? req.user?.userId;

    if (!userId) {
      // No authenticated user — let AuthGuard handle this
      return true;
    }

    const now = Date.now();
    const entry = this.store.get(userId);

    if (!entry || now - entry.windowStart >= UploadRateLimitGuard.WINDOW_MS) {
      // Start a fresh window
      this.store.set(userId, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= UploadRateLimitGuard.MAX_UPLOADS) {
      const resetInSec = Math.ceil(
        (entry.windowStart + UploadRateLimitGuard.WINDOW_MS - now) / 1000,
      );
      throw new HttpException(
        `Upload rate limit reached (${UploadRateLimitGuard.MAX_UPLOADS} uploads/hour). ` +
          `Resets in ${resetInSec}s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    entry.count += 1;
    return true;
  }

  /** Exposed for testing */
  clearStore(): void {
    this.store.clear();
  }
}
