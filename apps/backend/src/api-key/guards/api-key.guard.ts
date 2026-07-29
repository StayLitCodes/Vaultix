import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiKeysService } from '../api-key.service';
import { ApiRateLimitService } from '../api-rate-limit.service';
import { ApiKey } from '../entities/api-key.entity';

interface RequestWithApiKey extends Request {
  apiKey?: ApiKey;
  user?: {
    sub: string;
    apiKeyId: string;
  };
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private apiKeyService: ApiKeysService,
    private rateLimitService: ApiRateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<RequestWithApiKey>();
    const res = http.getResponse<Response>();

    const rawKey = req.header('X-API-Key');

    // If no API key provided, allow JWT auth to handle it
    if (!rawKey) {
      return true;
    }

    const key = await this.apiKeyService.findByRawKey(rawKey);

    if (!key) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (!key.isActive) {
      throw new ForbiddenException('API key revoked or inactive');
    }

    // Check if key is expired
    if (key.expiresAt && new Date() > key.expiresAt) {
      throw new ForbiddenException('API key has expired');
    }

    // Apply rate limiting
    const info = this.rateLimitService.check(key.id, key.rateLimitPerMinute);

    res.setHeader('X-RateLimit-Limit', info.limit);
    res.setHeader('X-RateLimit-Remaining', info.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(info.resetAt / 1000));

    // Attach API key and user info to request
    req.apiKey = key;
    req.user = { sub: key.userId, apiKeyId: key.id };

    // Async update of lastUsedAt (fire and forget)
    this.apiKeyService.updateLastUsedAt(key.id).catch(() => {
      // Silently fail to not block the request
    });

    return true;
  }
}
