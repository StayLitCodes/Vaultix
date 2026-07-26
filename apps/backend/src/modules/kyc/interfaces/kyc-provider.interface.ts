import { KycStatus } from '../entities/kyc-verification.entity';

/**
 * Result of initiating a KYC verification.
 */
export interface KycInitiateResult {
  /** Unique verification session ID from the provider */
  verificationId: string;
  /** URL the user should be redirected to for verification */
  redirectUrl: string;
  /** Expiration date of the verification session */
  expiresAt?: Date;
}

/**
 * Result from processing a webhook callback.
 */
export interface KycWebhookResult {
  /** The verification ID from the provider */
  verificationId: string;
  /** The user ID this verification belongs to */
  userId: string;
  /** Updated KYC status */
  status: KycStatus;
  /** Reason for rejection (if status is rejected) */
  rejectionReason?: string;
  /** Additional metadata from the provider */
  metadata?: Record<string, unknown>;
}

/**
 * Pluggable KYC provider interface.
 *
 * Implement this interface to integrate with a specific KYC provider
 * (Persona, Sumsub, Onfido, etc.).
 *
 * Each implementation should handle:
 * - Initiating verification sessions
 * - Retrieving verification status
 * - Validating and processing webhook callbacks
 */
export interface IKycProvider {
  /** Provider identifier */
  readonly name: string;

  /**
   * Initiate a new KYC verification session for a user.
   * @param userId - The user to verify
   * @param redirectPath - Optional redirect path after verification
   */
  initiateVerification(
    userId: string,
    redirectPath?: string,
  ): Promise<KycInitiateResult>;

  /**
   * Get the current verification status from the provider.
   * @param verificationId - The provider-issued verification ID
   */
  getVerificationStatus(verificationId: string): Promise<{
    status: KycStatus;
    rejectionReason?: string;
    metadata?: Record<string, unknown>;
  }>;

  /**
   * Validate an incoming webhook request signature.
   * @param payload - Raw request body
   * @param signature - Value of the X-KYC-Signature header
   */
  validateWebhook(payload: unknown, signature: string): boolean;

  /**
   * Process a validated webhook payload into a standardized result.
   * @param payload - The webhook payload
   */
  processWebhook(payload: any): Promise<KycWebhookResult>;
}
