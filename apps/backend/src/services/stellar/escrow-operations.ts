import * as StellarSdk from '@stellar/stellar-sdk';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EscrowOperationsService {
  private readonly logger = new Logger(EscrowOperationsService.name);

  /**
   * Creates operations for initializing an escrow contract
   * @param contractId The contract ID for the escrow
   * @param depositorPublicKey The public key of the depositor
   * @param recipientPublicKey The public key of the recipient
   * @param tokenAddress The address of the token contract
   * @param milestones Array of milestone definitions
   * @param deadline Unix timestamp deadline for escrow completion
   * @returns Array of operations for the transaction
   */
  createEscrowInitializationOps(
    escrowId: string,
    depositorPublicKey: string,
    recipientPublicKey: string,
    tokenAddress: string,
    milestones: Array<{ id: number; amount: string; description: string }>,
    deadline: number,
  ): StellarSdk.xdr.Operation[] {
    try {
      this.logger.log(
        `Creating escrow initialization ops for escrow ID: ${escrowId}`,
      );

      // In a real implementation, this would involve Soroban contract calls
      // For now, we'll simulate the operations needed
      const operations: StellarSdk.xdr.Operation[] = [];

      // Add the escrow creation operation (conceptual)
      // This would typically be a Soroban contract invocation in practice
      const escrowCreationOp = StellarSdk.Operation.manageData({
        name: `escrow_${escrowId}_creation`,
        value: JSON.stringify({
          depositor: depositorPublicKey,
          recipient: recipientPublicKey,
          token: tokenAddress,
          milestones,
          deadline,
        }),
        source: depositorPublicKey,
      });

      operations.push(escrowCreationOp);

      this.logger.log(
        `Created ${operations.length} operations for escrow initialization`,
      );
      return operations;
    } catch (error) {
      this.logger.error(
        `Failed to create escrow initialization ops: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Creates operations for funding an escrow
   * @param escrowId The escrow ID to fund
   * @param funderPublicKey The public key of the funder
   * @param amount The amount to deposit
   * @param asset The asset to deposit
   * @returns Array of operations for the transaction
   */
  createFundingOps(
    escrowId: string,
    funderPublicKey: string,
    amount: string,
    asset: StellarSdk.Asset,
  ): StellarSdk.xdr.Operation[] {
    try {
      this.logger.log(
        `Creating funding ops for escrow ID: ${escrowId}, amount: ${amount}`,
      );

      const operations: StellarSdk.xdr.Operation[] = [];

      // Payment operation to move funds to escrow (conceptual)
      const paymentOp = StellarSdk.Operation.payment({
        destination: funderPublicKey, // In a real implementation, this would be the escrow contract address
        asset: asset,
        amount: amount,
        source: funderPublicKey,
      });

      operations.push(paymentOp);

      // Store escrow funding data
      const fundingDataOp = StellarSdk.Operation.manageData({
        name: `escrow_${escrowId}_funded`,
        value: Buffer.from(
          JSON.stringify({
            amount,
            asset: asset.code
              ? `${asset.code}:${asset.issuer || 'native'}`
              : 'native',
          }),
        ),
        source: funderPublicKey,
      });

      operations.push(fundingDataOp);

      this.logger.log(
        `Created ${operations.length} operations for escrow funding`,
      );
      return operations;
    } catch (error) {
      this.logger.error(
        `Failed to create funding ops: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Creates operations for releasing a milestone payment
   * @param escrowId The escrow ID
   * @param milestoneId The milestone ID to release
   * @param releaserPublicKey The public key of the account releasing the payment
   * @param recipientPublicKey The public key of the recipient
   * @param amount The amount to release
   * @param asset The asset to release
   * @returns Array of operations for the transaction
   */
  createMilestoneReleaseOps(
    escrowId: string,
    milestoneId: number,
    releaserPublicKey: string,
    recipientPublicKey: string,
    amount: string,
    asset: StellarSdk.Asset,
  ): StellarSdk.xdr.Operation[] {
    try {
      this.logger.log(
        `Creating milestone release ops for escrow ID: ${escrowId}, milestone: ${milestoneId}`,
      );

      const operations: StellarSdk.xdr.Operation[] = [];

      // Payment operation to release funds (conceptual)
      const paymentOp = StellarSdk.Operation.payment({
        destination: recipientPublicKey,
        asset: asset,
        amount: amount,
        source: releaserPublicKey, // In real implementation, this would be the escrow contract
      });

      operations.push(paymentOp);

      // Update milestone status
      const milestoneCompleteOp = StellarSdk.Operation.manageData({
        name: `escrow_${escrowId}_milestone_${milestoneId}_completed`,
        value: Buffer.from(new Date().toISOString()),
        source: releaserPublicKey,
      });

      operations.push(milestoneCompleteOp);

      this.logger.log(
        `Created ${operations.length} operations for milestone release`,
      );
      return operations;
    } catch (error) {
      this.logger.error(
        `Failed to create milestone release ops: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Creates operations for confirming delivery/acceptance
   * @param escrowId The escrow ID
   * @param confirmerPublicKey The public key of the account confirming
   * @param confirmationStatus The status of the confirmation
   * @returns Array of operations for the transaction
   */
  createConfirmationOps(
    escrowId: string,
    confirmerPublicKey: string,
    confirmationStatus: 'confirmed' | 'disputed' | 'released',
  ): StellarSdk.xdr.Operation[] {
    try {
      this.logger.log(
        `Creating confirmation ops for escrow ID: ${escrowId}, status: ${confirmationStatus}`,
      );

      const operations: StellarSdk.xdr.Operation[] = [];

      // Record the confirmation status
      const confirmationOp = StellarSdk.Operation.manageData({
        name: `escrow_${escrowId}_confirmation_status`,
        value: Buffer.from(confirmationStatus),
        source: confirmerPublicKey,
      });

      operations.push(confirmationOp);

      // Timestamp the confirmation
      const timestampOp = StellarSdk.Operation.manageData({
        name: `escrow_${escrowId}_confirmation_timestamp`,
        value: Buffer.from(new Date().toISOString()),
        source: confirmerPublicKey,
      });

      operations.push(timestampOp);

      this.logger.log(
        `Created ${operations.length} operations for confirmation`,
      );
      return operations;
    } catch (error) {
      this.logger.error(
        `Failed to create confirmation ops: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Creates operations for canceling an escrow
   * @param escrowId The escrow ID to cancel
   * @param cancellerPublicKey The public key of the account canceling
   * @param refundDestination The destination for refunded funds
   * @returns Array of operations for the transaction
   */
  createCancelOps(
    escrowId: string,
    cancellerPublicKey: string,
    // refundDestination: string,
  ): StellarSdk.xdr.Operation[] {
    try {
      this.logger.log(`Creating cancel ops for escrow ID: ${escrowId}`);

      const operations: StellarSdk.xdr.Operation[] = [];

      // Record the cancellation
      const cancelOp = StellarSdk.Operation.manageData({
        name: `escrow_${escrowId}_cancelled`,
        value: Buffer.from(new Date().toISOString()),
        source: cancellerPublicKey,
      });

      operations.push(cancelOp);

      // In a real implementation, this would involve actual fund refund operations
      // For now, we're just recording the intent to cancel

      this.logger.log(
        `Created ${operations.length} operations for escrow cancellation`,
      );
      return operations;
    } catch (error) {
      this.logger.error(
        `Failed to create cancel ops: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Creates operations for completing an escrow
   * @param escrowId The escrow ID to complete
   * @param completerPublicKey The public key of the account completing
   * @returns Array of operations for the transaction
   */
  createCompletionOps(
    escrowId: string,
    completerPublicKey: string,
  ): StellarSdk.xdr.Operation[] {
    try {
      this.logger.log(`Creating completion ops for escrow ID: ${escrowId}`);

      const operations: StellarSdk.xdr.Operation[] = [];

      // Mark escrow as completed
      const completionOp = StellarSdk.Operation.manageData({
        name: `escrow_${escrowId}_completed`,
        value: Buffer.from(new Date().toISOString()),
        source: completerPublicKey,
      });

      operations.push(completionOp);

      // Clear temporary data
      const clearTempDataOp = StellarSdk.Operation.manageData({
        name: `escrow_${escrowId}_temporary_data`,
        value: null, // This deletes the data entry
        source: completerPublicKey,
      });

      operations.push(clearTempDataOp);

      this.logger.log(
        `Created ${operations.length} operations for escrow completion`,
      );
      return operations;
    } catch (error) {
      this.logger.error(
        `Failed to create completion ops: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Safely extracts error message from unknown error type
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'object' && error !== null && 'message' in error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      return String((error as any).message);
    }
    return 'Unknown error';
  }
}
