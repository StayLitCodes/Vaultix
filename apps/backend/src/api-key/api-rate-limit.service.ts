import { Injectable, RequestTimeoutException } from '@nestjs/common';

@Injectable()
export class ApiRateLimitService {
  private usage = new Map<string, { count: number; resetAt: number }>();

  check(keyId: string, limit: number) {
    const now = Date.now();
    const windowMs = 60 * 1000;

    const record = this.usage.get(keyId);

    if (!record || now > record.resetAt) {
      this.usage.set(keyId, {
        count: 1,
        resetAt: now + windowMs,
      });
      return;
    }

    if (record.count >= limit) {
      throw new RequestTimeoutException('Rate limit exceeded');
    }

    record.count++;
  }
}
