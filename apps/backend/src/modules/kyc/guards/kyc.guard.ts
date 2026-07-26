import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { KycService } from '../services/kyc.service';
import { ConfigService } from '@nestjs/config';
import { KycStatus } from '../entities/kyc-verification.entity';

/**
 * Guard that restricts access to users with verified KYC status.
 *
 * Use this guard on routes that should only be accessible to
 * identity-verified users.
 *
 * Optional: configure KYC_REQUIRED_MIN_ESCROW_AMOUNT to only gate
 * escrows above a certain threshold.
 *
 * Usage:
 * @UseGuards(KycGuard)
 * OR
 * @UseGuards(AuthGuard, KycGuard) for combined auth + KYC
 */
@Injectable()
export class KycGuard implements CanActivate {
  private readonly logger = new Logger(KycGuard.name);
  private readonly minEscrowAmount: number;

  constructor(
    private readonly kycService: KycService,
    private readonly configService: ConfigService,
  ) {
    this.minEscrowAmount = parseFloat(
      this.configService.get<string>(
        'KYC_REQUIRED_MIN_ESCROW_AMOUNT',
        '1000',
      ) || '1000',
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: { userId: string } }>();

    const user = request['user'];
    if (!user?.userId) {
      throw new ForbiddenException(
        'Authentication required for KYC-verified actions',
      );
    }

    // Check if this is an escrow creation endpoint with an amount
    const body = request.body as Record<string, unknown> | undefined;
    if (body?.amount) {
      const amount = parseFloat(String(body.amount));
      if (Number.isNaN(amount) || amount < this.minEscrowAmount) {
        // Below threshold or invalid amount, skip KYC check
        return true;
      }
    }

    const isVerified = await this.kycService.isKycVerified(user.userId);

    if (!isVerified) {
      throw new ForbiddenException(
        'KYC verification is required for this action. ' +
          'Please complete identity verification before proceeding.',
      );
    }

    return true;
  }
}
