import {
  Injectable,
  CanActivate,
  ExecutionContext,
  TooManyRequestsException,
} from '@nestjs/common';
import { Request } from 'express';

interface AuthUser {
  sub?: string;
  userId?: string;
}

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_UPLOADS = 20;

@Injectable()
export class UploadRateLimitGuard implements CanActivate {
  private readonly counts = new Map<string, { count: number; resetAt: number }>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request['user'] as AuthUser | undefined;
    const userId = user?.sub ?? user?.userId;

    if (!userId) return true;

    const now = Date.now();
    const entry = this.counts.get(userId);

    if (!entry || entry.resetAt <= now) {
      this.counts.set(userId, { count: 1, resetAt: now + WINDOW_MS });
      return true;
    }

    if (entry.count >= MAX_UPLOADS) {
      throw new TooManyRequestsException(
        'Upload rate limit exceeded: max 20 uploads per hour',
      );
    }

    entry.count += 1;
    return true;
  }
}
