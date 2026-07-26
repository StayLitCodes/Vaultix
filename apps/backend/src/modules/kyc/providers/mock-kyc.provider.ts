import { Injectable, Logger } from '@nestjs/common';
import {
  IKycProvider,
  KycInitiateResult,
  KycWebhookResult,
} from '../interfaces/kyc-provider.interface';
import { KycStatus } from '../entities/kyc-verification.entity';

/**
 * Mock KYC provider for development and testing.
 *
 * This provider simulates the KYC verification flow without requiring
 * an actual third-party KYC service. It automatically approves verifications
 * after a simulated delay or can be configured to reject for testing.
 *
 * To test webhook callbacks, send a POST to the webhook endpoint with:
 * ```json
 * {
 *   "verificationId": "<id>",
 *   "status": "verified" | "rejected",
 *   "rejectionReason": "optional reason"
 * }
 * ```
 *
 * Signatures are not validated for the mock provider.
 */
@Injectable()
export class MockKycProvider implements IKycProvider {
  private readonly logger = new Logger(MockKycProvider.name);
  readonly name = 'mock';

  /** In-memory store for mock verifications */
  private verifications = new Map<
    string,
    { userId: string; status: KycStatus; reason?: string }
  >();

  async initiateVerification(
    userId: string,
    redirectPath?: string,
  ): Promise<KycInitiateResult> {
    const verificationId = `mock-kyc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    this.verifications.set(verificationId, {
      userId,
      status: KycStatus.PENDING,
    });

    this.logger.log(
      `Initiated mock KYC verification: ${verificationId} for user ${userId}`,
    );

    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const redirectUrl = `${baseUrl}/v1/kyc/mock-verify?id=${verificationId}&redirect=${encodeURIComponent(redirectPath || '/')}`;

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    return {
      verificationId,
      redirectUrl,
      expiresAt,
    };
  }

  async getVerificationStatus(verificationId: string): Promise<{
    status: KycStatus;
    rejectionReason?: string;
    metadata?: Record<string, unknown>;
  }> {
    const verification = this.verifications.get(verificationId);
    if (!verification) {
      return { status: KycStatus.NOT_STARTED };
    }

    return {
      status: verification.status,
      rejectionReason: verification.reason,
      metadata: { provider: 'mock' },
    };
  }

  validateWebhook(_payload: unknown, _signature: string): boolean {
    // Mock provider does not validate signatures
    return true;
  }

  async processWebhook(payload: any): Promise<KycWebhookResult> {
    const { verificationId, status, rejectionReason } = payload;

    if (!verificationId) {
      throw new Error('verificationId is required in webhook payload');
    }

    const verification = this.verifications.get(verificationId);
    if (!verification) {
      throw new Error(`Unknown verification ID: ${verificationId}`);
    }

    // Update internal state
    verification.status = status as KycStatus;
    if (rejectionReason) {
      verification.reason = rejectionReason;
    }

    this.logger.log(
      `Webhook processed: verification ${verificationId} -> ${status}`,
    );

    return {
      verificationId,
      userId: verification.userId,
      status: status as KycStatus,
      rejectionReason,
      metadata: { provider: 'mock' },
    };
  }
}
