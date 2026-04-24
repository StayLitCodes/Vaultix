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
import { ApiKey, TIER_LIMITS } from '../entities/api-key.entity';

interface RequestWithApiKey extends Request {
  apiKey?: ApiKey;
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
    if (!rawKey) {
      throw new UnauthorizedException('Missing API key');
    }

    const key = await this.apiKeyService.findByRawKey(rawKey);

    if (!key) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (!key.active) {
      throw new ForbiddenException('API key revoked');
    }

    const limit = TIER_LIMITS[key.tier] ?? key.rateLimitPerMinute;
    const info = this.rateLimitService.check(key.id, limit);

    res.setHeader('X-RateLimit-Limit', info.limit);
    res.setHeader('X-RateLimit-Remaining', info.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(info.resetAt / 1000));

    req.apiKey = key;
    return true;
  }
}
