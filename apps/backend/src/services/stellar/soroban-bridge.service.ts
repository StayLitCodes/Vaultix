import { Injectable, Logger } from '@nestjs/common';
import { StellarService } from '../../services/stellar.service';
import { EscrowOperationsService } from './escrow-operations';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Escrow } from '../../modules/escrow/entities/escrow.entity';
import * as StellarSdk from '@stellar/stellar-sdk';
import { StellarSubmitTransactionResponse } from '../../types/stellar.types';
import { ConsistencyCheckerService } from '../../modules/admin/services/consistency-checker.service';

@Injectable()
export class SorobanBridgeService {
  private readonly logger = new Logger(SorobanBridgeService.name);
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 2000;

  constructor(
    private readonly stellarService: StellarService,
    private readonly escrowOperationsService: EscrowOperationsService,
    @InjectRepository(Escrow)
    private readonly escrowRepository: Repository<Escrow>,
    private readonly consistencyCheckerService: ConsistencyCheckerService,
  ) {}

  /**
   * Helper to sleep for a given duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Safe error message extractor
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error !== null && 'message' in error) {
      return String((error as { message: unknown }).message);
    }
    return 'Unknown error';
  }

  /**
   * Helper to submit transaction with retry logic and error mapping
   */
  private async submitWithRetry(
    transaction: StellarSdk.Transaction,
    operationName: string,
  ): Promise<StellarSubmitTransactionResponse> {
    let attempt = 0;
    while (attempt < this.MAX_RETRIES) {
      try {
        const result = await this.stellarService.submitTransaction(transaction);
        this.logger.log(
          `Successfully executed ${operationName}, tx: ${result.hash}`,
        );
        return result;
      } catch (error) {
        attempt++;
        this.logger.warn(
          `Attempt ${attempt} failed for ${operationName}: ${this.getErrorMessage(error)}`,
        );
        if (attempt >= this.MAX_RETRIES) {
          this.logger.error(`Max retries reached for ${operationName}`);
          throw new Error(
            `Failed to execute ${operationName} after ${this.MAX_RETRIES} attempts. Error: ${this.getErrorMessage(error)}`,
          );
        }
        await this.sleep(this.RETRY_DELAY_MS * attempt);
      }
    }
    throw new Error('Unreachable');
  }

  /**
   * Triggers a state consistency check after a successful on-chain operation
   */
  private async triggerStateSync(escrowId: string) {
    try {
      this.logger.log(
        `Triggering consistency check for escrow ${escrowId} to sync state.`,
      );
      await this.consistencyCheckerService.checkConsistency({
        escrowIds: [Number(escrowId)],
      });
    } catch (error) {
      this.logger.error(
        `Failed to trigger state sync for escrow ${escrowId}: ${this.getErrorMessage(error)}`,
      );
    }
  }

  async createEscrowOnChain(
    escrowId: string,
    depositorPublicKey: string,
    recipientPublicKey: string,
    tokenAddress: string,
    milestones: Array<{ id: number; amount: string; description: string }>,
    deadline: number,
    metadataReference: string,
  ): Promise<string> {
    const operations =
      this.escrowOperationsService.createEscrowInitializationOps(
        escrowId,
        depositorPublicKey,
        recipientPublicKey,
        tokenAddress,
        milestones,
        deadline,
        metadataReference,
      );

    const transaction = await this.stellarService.buildTransaction(
      depositorPublicKey,
      operations,
    );
    const result = await this.submitWithRetry(
      transaction,
      'createEscrowOnChain',
    );

    await this.triggerStateSync(escrowId);
    return result.hash;
  }

  async depositFundsOnChain(
    escrowId: string,
    funderPublicKey: string,
  ): Promise<string> {
    const operations = this.escrowOperationsService.createFundingOps(escrowId);
    const transaction = await this.stellarService.buildTransaction(
      funderPublicKey,
      operations,
    );
    const result = await this.submitWithRetry(
      transaction,
      'depositFundsOnChain',
    );

    await this.triggerStateSync(escrowId);
    return result.hash;
  }

  async releaseMilestoneOnChain(
    escrowId: string,
    milestoneId: number,
    releaserPublicKey: string,
  ): Promise<string> {
    const operations = this.escrowOperationsService.createMilestoneReleaseOps(
      escrowId,
      milestoneId,
    );
    const transaction = await this.stellarService.buildTransaction(
      releaserPublicKey,
      operations,
    );
    const result = await this.submitWithRetry(
      transaction,
      'releaseMilestoneOnChain',
    );

    await this.triggerStateSync(escrowId);
    return result.hash;
  }

  async raiseDisputeOnChain(
    escrowId: string,
    callerPublicKey: string,
  ): Promise<string> {
    const operations = this.escrowOperationsService.createDisputeOps(
      escrowId,
      callerPublicKey,
    );
    const transaction = await this.stellarService.buildTransaction(
      callerPublicKey,
      operations,
    );
    const result = await this.submitWithRetry(
      transaction,
      'raiseDisputeOnChain',
    );

    await this.triggerStateSync(escrowId);
    return result.hash;
  }

  async resolveDisputeOnChain(
    escrowId: string,
    arbitratorPublicKey: string,
    winnerPublicKey: string,
    splitWinnerAmount?: string,
  ): Promise<string> {
    const operations = this.escrowOperationsService.createResolveDisputeOps(
      escrowId,
      winnerPublicKey,
      splitWinnerAmount,
    );
    const transaction = await this.stellarService.buildTransaction(
      arbitratorPublicKey,
      operations,
    );
    const result = await this.submitWithRetry(
      transaction,
      'resolveDisputeOnChain',
    );

    await this.triggerStateSync(escrowId);
    return result.hash;
  }

  async cancelEscrowOnChain(
    escrowId: string,
    cancellerPublicKey: string,
  ): Promise<string> {
    const operations = this.escrowOperationsService.createCancelOps(escrowId);
    const transaction = await this.stellarService.buildTransaction(
      cancellerPublicKey,
      operations,
    );
    const result = await this.submitWithRetry(
      transaction,
      'cancelEscrowOnChain',
    );

    await this.triggerStateSync(escrowId);
    return result.hash;
  }

  async refundExpiredOnChain(
    escrowId: string,
    callerPublicKey: string,
  ): Promise<string> {
    // Assuming cancel_escrow works for refunds as well on expired escrows, or there's a specific method.
    // Given the available operations, it seems cancelOps or completeOps might be used.
    // If there was a specific refund op, we'd use it. For now we use cancelOps as it's the closest to refund.
    const operations = this.escrowOperationsService.createCancelOps(escrowId);
    const transaction = await this.stellarService.buildTransaction(
      callerPublicKey,
      operations,
    );
    const result = await this.submitWithRetry(
      transaction,
      'refundExpiredOnChain',
    );

    await this.triggerStateSync(escrowId);
    return result.hash;
  }
}
