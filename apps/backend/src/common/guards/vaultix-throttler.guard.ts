import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerLimitDetail,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';

/**
 * Application-wide rate-limit guard.
 *
 * Throttler tiers (configured in ThrottlerModule):
 *   'default'  – IP-based, 100 req/min by default (GETs, general)
 *   'user'     – user-ID-based, overridden per-endpoint (POST /escrows, POST /webhooks)
 *
 * Response headers set automatically by the base class on every request:
 *   X-RateLimit-Limit[-<name>]
 *   X-RateLimit-Remaining[-<name>]
 *   X-RateLimit-Reset[-<name>]
 *   Retry-After[-<name>] (on 429 only)
 *
 * This guard additionally ensures a plain Retry-After header (no suffix) and
 * emits a warn log on every violation so rate-limit events are traceable.
 */
@Injectable()
export class VaultixThrottlerGuard extends ThrottlerGuard {
  protected readonly logger = new Logger('RateLimit');

  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  /** Use client IP as the default tracker, honouring X-Forwarded-For. */
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const fwd = (req.headers as Record<string, string | string[]>)?.[
      'x-forwarded-for'
    ];
    if (typeof fwd === 'string') {
      const first = fwd.split(',')[0]?.trim();
      if (first) return first;
    }
    return (
      (req.ip as string) ||
      (req.connection as { remoteAddress?: string })?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * For the 'user' throttler the bucket key is the authenticated user ID,
   * so the limit is per-account regardless of IP. Falls back to IP when the
   * request has no authenticated user. All other throttlers use the IP tracker.
   */
  protected generateKey(
    context: ExecutionContext,
    tracker: string,
    throttlerName: string,
  ): string {
    const endpoint = `${context.getClass().name}:${context.getHandler().name}`;
    if (throttlerName === 'user') {
      const req = context
        .switchToHttp()
        .getRequest<{ user?: { sub?: string; userId?: string } }>();
      const userId = req.user?.sub ?? req.user?.userId;
      return userId
        ? `rl:${endpoint}:user:${userId}`
        : `rl:${endpoint}:user:ip:${tracker}`;
    }
    return `rl:${endpoint}:${throttlerName}:${tracker}`;
  }

  /**
   * Before throwing the 429:
   *   1. Write a plain `Retry-After` header (base class writes `Retry-After-<name>`
   *      for non-default throttlers; clients expect the un-suffixed header).
   *   2. Emit a warn-level log so violations are traceable in the application log.
   */
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const { req, res } = this.getRequestResponse(context) as {
      req: { ip?: string; method?: string; url?: string };
      res: { header: (name: string, value: string | number) => void };
    };

    // Ensure the standard Retry-After header is always present.
    res.header('Retry-After', throttlerLimitDetail.timeToBlockExpire);

    this.logger.warn(
      `Rate limit exceeded | ${req.method ?? 'UNKNOWN'} ${req.url ?? ''} | ` +
        `limit=${throttlerLimitDetail.limit} | ip=${req.ip ?? 'unknown'}`,
    );

    await super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
