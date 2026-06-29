import { Injectable } from '@nestjs/common';
import { VaultixThrottlerGuard } from '../../../common/guards/vaultix-throttler.guard';

/**
 * Auth-specific throttler guard.
 * Inherits IP-based tracking, header injection, and violation logging from
 * VaultixThrottlerGuard. Per-endpoint limits are set via @Throttle decorators
 * on AuthController methods.
 */
@Injectable()
export class AuthThrottlerGuard extends VaultixThrottlerGuard {}
