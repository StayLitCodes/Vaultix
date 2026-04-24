import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: number;
}

@Injectable()
export class ApiRateLimitService {
  private readonly usage = new Map<string, RateLimitRecord>();
  private readonly windowMs = 60 * 1000;

  check(keyId: string, limit: number): RateLimitInfo {
    const now = Date.now();
    const record = this.usage.get(keyId);

    if (!record || now > record.resetAt) {
      const resetAt = now + this.windowMs;
      this.usage.set(keyId, { count: 1, resetAt });
      return { limit, remaining: limit - 1, resetAt };
    }

    if (record.count >= limit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded. Please retry after the reset window.',
          retryAfter: Math.ceil((record.resetAt - now) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    record.count++;
    return { limit, remaining: limit - record.count, resetAt: record.resetAt };
  }
}
