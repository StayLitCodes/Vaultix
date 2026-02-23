import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiKeysService } from '../api-key.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private apiKeyService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

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

    req.apiKey = key; // attach integrator identity
    return true;
  }
}
