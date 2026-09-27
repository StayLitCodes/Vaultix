/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
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

  initiateVerification(
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

    return Promise.resolve({
      verificationId,
      redirectUrl,
      expiresAt,
    });
  }

  getVerificationStatus(verificationId: string): Promise<{
    status: KycStatus;
    rejectionReason?: string;
    metadata?: Record<string, unknown>;
  }> {
    const verification = this.verifications.get(verificationId);
    if (!verification) {
      return Promise.resolve({ status: KycStatus.NOT_STARTED });
    }

    return Promise.resolve({
      status: verification.status,
      rejectionReason: verification.reason,
      metadata: { provider: 'mock' },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  validateWebhook(payload: unknown, signature: string): boolean {
    // Mock provider does not validate signatures — params intentionally unused
    return true;
  }

  processWebhook(payload: unknown): Promise<KycWebhookResult> {
    const p = payload as {
      verificationId?: string;
      status?: string;
      rejectionReason?: string;
    };
    const { verificationId, status, rejectionReason } = p;

    if (!verificationId) {
      return Promise.reject(
        new Error('verificationId is required in webhook payload'),
      );
    }

    const verification = this.verifications.get(verificationId);
    if (!verification) {
      return Promise.reject(
        new Error(`Unknown verification ID: ${verificationId}`),
      );
    }

    // Update internal state
    verification.status = status as KycStatus;
    if (rejectionReason) {
      verification.reason = rejectionReason;
    }

    this.logger.log(
      `Webhook processed: verification ${verificationId} -> ${String(status)}`,
    );

    return Promise.resolve({
      verificationId,
      userId: verification.userId,
      status: status as KycStatus,
      rejectionReason,
      metadata: { provider: 'mock' },
    });
  }
}
