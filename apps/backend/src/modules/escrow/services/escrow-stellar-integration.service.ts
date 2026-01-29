import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as StellarSdk from '@stellar/stellar-sdk';
import { Escrow } from '../entities/escrow.entity';
import { Party } from '../entities/party.entity';
import { Condition } from '../entities/condition.entity';
import { StellarService } from '../../../services/stellar.service';
import { EscrowOperationsService } from '../../../services/stellar/escrow-operations';
import stellarConfig from '../../../config/stellar.config';
import {
  StellarSubmitTransactionResponse,
  StellarTransactionResponse,
} from '../../../types/stellar.types';

@Injectable()
export class EscrowStellarIntegrationService {
  private readonly logger = new Logger(EscrowStellarIntegrationService.name);

  constructor(
    @Inject(stellarConfig.KEY)
    private config: ConfigType<typeof stellarConfig>,
    private stellarService: StellarService,
    private escrowOperationsService: EscrowOperationsService,
    @InjectRepository(Escrow)
    private escrowRepository: Repository<Escrow>,
    @InjectRepository(Party)
    private partyRepository: Repository<Party>,
    @InjectRepository(Condition)
    private conditionRepository: Repository<Condition>,
  ) {}

  /**
   * Creates an escrow contract on the Stellar blockchain
   * @param escrowId The ID of the escrow to create on-chain
   * @returns Transaction hash of the creation transaction
   */
  async createOnChainEscrow(escrowId: string): Promise<string> {
    try {
      this.logger.log(`Creating on-chain escrow for ID: ${escrowId}`);

      // Get the escrow from the database
      const escrow = await this.escrowRepository.findOne({
        where: { id: escrowId },
        relations: ['parties', 'conditions'],
      });

      if (!escrow) {
        throw new Error(`Escrow with ID ${escrowId} not found`);
      }

      // Get the depositor (usually the buyer)
      const depositor = escrow.parties.find(
        (party) => party.role === ('buyer' as any),
      );
      if (!depositor) {
        throw new Error(`Depositor not found for escrow ${escrowId}`);
      }

      // Get the recipient (usually the seller)
      const recipient = escrow.parties.find(
        (party) => party.role === ('seller' as any),
      );
      if (!recipient) {
        throw new Error(`Recipient not found for escrow ${escrowId}`);
      }

      // Convert conditions to milestones format
      const milestones = escrow.conditions.map((condition, index) => ({
        id: index,
        amount: (
          parseFloat(escrow.amount.toString()) / escrow.conditions.length
        ).toString(),
        description: condition.description,
      }));

      // Create operations for escrow initialization
      const operations =
        this.escrowOperationsService.createEscrowInitializationOps(
          escrowId,
          depositor.user.walletAddress, // User's Stellar wallet address
          recipient.user.walletAddress, // User's Stellar wallet address
          'native', // Using XLM as the asset for this example
          milestones,
          escrow.expiresAt
            ? Math.floor(new Date(escrow.expiresAt).getTime() / 1000)
            : Math.floor(Date.now() / 1000) + 86400, // Convert to Unix timestamp or default to 24 hours
        );

      // Build the transaction
      const transaction = await this.stellarService.buildTransaction(
        depositor.user.walletAddress, // Source account
        operations,
      );

      // Submit the transaction to the Stellar network
      const result: StellarSubmitTransactionResponse =
        await this.stellarService.submitTransaction(transaction);

      this.logger.log(
        `Successfully created on-chain escrow ${escrowId}, transaction: ${result.hash}`,
      );
      return result.hash;
    } catch (error) {
      this.logger.error(
        `Failed to create on-chain escrow ${escrowId}: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Funds an escrow on the Stellar blockchain
   * @param escrowId The ID of the escrow to fund
   * @param funderPublicKey The public key of the account funding the escrow
   * @param amount The amount to fund
   * @param assetCode The asset code (e.g., 'XLM' or custom asset)
   * @returns Transaction hash of the funding transaction
   */
  async fundOnChainEscrow(
    escrowId: string,
    funderPublicKey: string,
    amount: string,
    assetCode: string = 'XLM',
  ): Promise<string> {
    try {
      this.logger.log(
        `Funding on-chain escrow ${escrowId} with ${amount} ${assetCode}`,
      );

      // Determine asset
      const asset =
        assetCode === 'XLM' || assetCode === 'native'
          ? StellarSdk.Asset.native()
          : new StellarSdk.Asset(assetCode, funderPublicKey); // Simplified - in reality, issuer would be different

      // Create funding operations
      const operations = this.escrowOperationsService.createFundingOps(
        escrowId,
        funderPublicKey,
        amount,
        asset,
      );

      // Build the transaction
      const transaction = await this.stellarService.buildTransaction(
        funderPublicKey, // Source account
        operations,
      );

      // Submit the transaction to the Stellar network
      const result: StellarSubmitTransactionResponse =
        await this.stellarService.submitTransaction(transaction);

      this.logger.log(
        `Successfully funded escrow ${escrowId}, transaction: ${result.hash}`,
      );
      return result.hash;
    } catch (error) {
      this.logger.error(
        `Failed to fund on-chain escrow ${escrowId}: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Releases a milestone payment on the Stellar blockchain
   * @param escrowId The ID of the escrow
   * @param milestoneId The ID of the milestone to release
   * @param releaserPublicKey The public key of the account releasing the payment
   * @param recipientPublicKey The public key of the recipient
   * @param amount The amount to release
   * @param assetCode The asset code
   * @returns Transaction hash of the release transaction
   */
  async releaseMilestonePayment(
    escrowId: string,
    milestoneId: number,
    releaserPublicKey: string,
    recipientPublicKey: string,
    amount: string,
    assetCode: string = 'XLM',
  ): Promise<string> {
    try {
      this.logger.log(
        `Releasing milestone ${milestoneId} for escrow ${escrowId}`,
      );

      // Determine asset
      const asset =
        assetCode === 'XLM' || assetCode === 'native'
          ? StellarSdk.Asset.native()
          : new StellarSdk.Asset(assetCode, recipientPublicKey); // Simplified

      // Create milestone release operations
      const operations = this.escrowOperationsService.createMilestoneReleaseOps(
        escrowId,
        milestoneId,
        releaserPublicKey,
        recipientPublicKey,
        amount,
        asset,
      );

      // Build the transaction
      const transaction = await this.stellarService.buildTransaction(
        releaserPublicKey, // Source account
        operations,
      );

      // Submit the transaction to the Stellar network
      const result: StellarSubmitTransactionResponse =
        await this.stellarService.submitTransaction(transaction);

      this.logger.log(
        `Successfully released milestone ${milestoneId} for escrow ${escrowId}, transaction: ${result.hash}`,
      );
      return result.hash;
    } catch (error) {
      this.logger.error(
        `Failed to release milestone ${milestoneId} for escrow ${escrowId}: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Confirms delivery/acceptance of an escrow on the Stellar blockchain
   * @param escrowId The ID of the escrow to confirm
   * @param confirmerPublicKey The public key of the account confirming
   * @param confirmationStatus The status of the confirmation
   * @returns Transaction hash of the confirmation transaction
   */
  async confirmEscrow(
    escrowId: string,
    confirmerPublicKey: string,
    confirmationStatus: 'confirmed' | 'disputed' | 'released' = 'confirmed',
  ): Promise<string> {
    try {
      this.logger.log(
        `Confirming escrow ${escrowId} with status: ${confirmationStatus}`,
      );

      // Create confirmation operations
      const operations = this.escrowOperationsService.createConfirmationOps(
        escrowId,
        confirmerPublicKey,
        confirmationStatus,
      );

      // Build the transaction
      const transaction = await this.stellarService.buildTransaction(
        confirmerPublicKey, // Source account
        operations,
      );

      // Submit the transaction to the Stellar network
      const result: StellarSubmitTransactionResponse =
        await this.stellarService.submitTransaction(transaction);

      this.logger.log(
        `Successfully confirmed escrow ${escrowId} with status ${confirmationStatus}, transaction: ${result.hash}`,
      );
      return result.hash;
    } catch (error) {
      this.logger.error(
        `Failed to confirm escrow ${escrowId}: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Cancels an escrow on the Stellar blockchain
   * @param escrowId The ID of the escrow to cancel
   * @param cancellerPublicKey The public key of the account canceling
   * @param refundDestination The destination for refunded funds
   * @returns Transaction hash of the cancellation transaction
   */
  async cancelOnChainEscrow(
    escrowId: string,
    cancellerPublicKey: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    refundDestination: string,
  ): Promise<string> {
    try {
      this.logger.log(`Canceling on-chain escrow ${escrowId}`);

      // Create cancel operations
      const operations = this.escrowOperationsService.createCancelOps(
        escrowId,
        cancellerPublicKey,
      );

      // Build the transaction
      const transaction = await this.stellarService.buildTransaction(
        cancellerPublicKey, // Source account
        operations,
      );

      // Submit the transaction to the Stellar network
      const result: StellarSubmitTransactionResponse =
        await this.stellarService.submitTransaction(transaction);

      this.logger.log(
        `Successfully canceled escrow ${escrowId}, transaction: ${result.hash}`,
      );
      return result.hash;
    } catch (error) {
      this.logger.error(
        `Failed to cancel on-chain escrow ${escrowId}: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Completes an escrow on the Stellar blockchain
   * @param escrowId The ID of the escrow to complete
   * @param completerPublicKey The public key of the account completing
   * @returns Transaction hash of the completion transaction
   */
  async completeOnChainEscrow(
    escrowId: string,
    completerPublicKey: string,
  ): Promise<string> {
    try {
      this.logger.log(`Completing on-chain escrow ${escrowId}`);

      // Create completion operations
      const operations = this.escrowOperationsService.createCompletionOps(
        escrowId,
        completerPublicKey,
      );

      // Build the transaction
      const transaction = await this.stellarService.buildTransaction(
        completerPublicKey, // Source account
        operations,
      );

      // Submit the transaction to the Stellar network
      const result: StellarSubmitTransactionResponse =
        await this.stellarService.submitTransaction(transaction);

      this.logger.log(
        `Successfully completed escrow ${escrowId}, transaction: ${result.hash}`,
      );
      return result.hash;
    } catch (error) {
      this.logger.error(
        `Failed to complete on-chain escrow ${escrowId}: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Monitors the status of an on-chain escrow
   * @param escrowId The ID of the escrow to monitor
   * @param accountPublicKey The public key of the account to monitor
   * @param callback Callback function to handle state changes
   * @returns EventSource object for stream control
   */
  monitorOnChainEscrow(
    escrowId: string,
    accountPublicKey: string,
    callback: (transaction: StellarTransactionResponse) => void,
  ): EventSource {
    this.logger.log(
      `Starting to monitor on-chain escrow ${escrowId} for account: ${accountPublicKey}`,
    );

    // Create a wrapper callback that filters for our escrow-related transactions
    const filteredCallback = (transaction: StellarTransactionResponse) => {
      // Check if this transaction relates to our escrow
      const isEscrowRelated =
        transaction.memo &&
        typeof transaction.memo === 'string' &&
        transaction.memo.includes(escrowId);

      if (isEscrowRelated) {
        this.logger.log(
          `Detected escrow ${escrowId} related transaction: ${transaction.hash}`,
        );
        callback(transaction);
      }
    };

    // Stream transactions for the account
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.stellarService.streamTransactions(
      accountPublicKey,
      filteredCallback,
    );
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
