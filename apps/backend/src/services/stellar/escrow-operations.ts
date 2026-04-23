import * as StellarSdk from '@stellar/stellar-sdk';
import { Injectable, Logger } from '@nestjs/common';
import { Client as ContractClient, MilestoneStatus } from 'contract-bindings';

@Injectable()
export class EscrowOperationsService {
  private readonly logger = new Logger(EscrowOperationsService.name);
  private readonly contractId: string;
  private readonly networkPassphrase: string;
  private readonly rpcUrl: string;
  private client: ContractClient;

  constructor() {
    this.contractId = process.env.STELLAR_CONTRACT_ID || '';
    this.networkPassphrase =
      process.env.STELLAR_NETWORK_PASSPHRASE ||
      'Test SDF Network ; September 2015';
    this.rpcUrl =
      process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';

    this.client = new ContractClient({
      rpcUrl: this.rpcUrl,
      networkPassphrase: this.networkPassphrase,
      contractId: this.contractId,
      allowHttp: true,
    });
  }

  /**
   * Creates operations for initializing an escrow contract
   */
  async createEscrowInitializationOps(
    escrowId: string,
    depositorPublicKey: string,
    recipientPublicKey: string,
    tokenAddress: string,
    milestones: Array<{ id: number; amount: string; description: string }>,
    deadline: number,
  ): Promise<StellarSdk.xdr.Operation[]> {
    try {
      this.logger.log(
        `Creating escrow initialization ops for escrow ID: ${escrowId}`,
      );

      const milestoneList = milestones.map((m) => ({
        amount: BigInt(m.amount),
        description: m.description.replace(/\s+/g, '_'),
        status: { tag: 'Pending', values: undefined } as MilestoneStatus,
      }));

      const tx = await this.client.create_escrow({
        escrow_id: BigInt(escrowId),
        depositor: depositorPublicKey,
        recipient: recipientPublicKey,
        token_address:
          tokenAddress === 'native'
            ? 'CDLZFC3SYJYDZT7K67VZ75YJFCGSN5W4B77T2YI2EHCWH6I6D6LNCU6B'
            : tokenAddress,
        milestones: milestoneList,
        deadline: BigInt(deadline),
        metadata_hash: Buffer.alloc(32), // Placeholder if not provided
      });

      return [tx.asOperation()];
    } catch (error) {
      this.logger.error(
        `Failed to create escrow initialization ops: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Creates operations for funding an escrow
   */
  async createFundingOps(
    escrowId: string,
  ): Promise<StellarSdk.xdr.Operation[]> {
    try {
      this.logger.log(`Creating funding ops for escrow ID: ${escrowId}`);

      const tx = await this.client.deposit_funds({
        escrow_id: BigInt(escrowId),
      });

      return [tx.asOperation()];
    } catch (error) {
      this.logger.error(
        `Failed to create funding ops: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Creates operations for releasing a milestone payment
   */
  async createMilestoneReleaseOps(
    escrowId: string,
    milestoneId: number,
  ): Promise<StellarSdk.xdr.Operation[]> {
    try {
      this.logger.log(
        `Creating milestone release ops for escrow ID: ${escrowId}, milestone: ${milestoneId}`,
      );

      const tx = await this.client.release_milestone({
        escrow_id: BigInt(escrowId),
        milestone_index: milestoneId,
      });

      return [tx.asOperation()];
    } catch (error) {
      this.logger.error(
        `Failed to create milestone release ops: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Creates operations for confirming delivery/acceptance
   */
  async createConfirmationOps(
    escrowId: string,
    confirmerPublicKey: string,
    milestoneId: number,
  ): Promise<StellarSdk.xdr.Operation[]> {
    try {
      this.logger.log(
        `Creating confirmation ops for escrow ID: ${escrowId}, milestone: ${milestoneId}`,
      );

      const tx = await this.client.confirm_delivery({
        escrow_id: BigInt(escrowId),
        milestone_index: milestoneId,
        buyer: confirmerPublicKey,
      });

      return [tx.asOperation()];
    } catch (error) {
      this.logger.error(
        `Failed to create confirmation ops: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Creates operations for canceling an escrow
   */
  async createCancelOps(escrowId: string): Promise<StellarSdk.xdr.Operation[]> {
    try {
      this.logger.log(`Creating cancel ops for escrow ID: ${escrowId}`);

      const tx = await this.client.cancel_escrow({
        escrow_id: BigInt(escrowId),
      });

      return [tx.asOperation()];
    } catch (error) {
      this.logger.error(
        `Failed to create cancel ops: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Creates operations for completing an escrow
   */
  async createCompletionOps(
    escrowId: string,
  ): Promise<StellarSdk.xdr.Operation[]> {
    try {
      this.logger.log(`Creating completion ops for escrow ID: ${escrowId}`);

      const tx = await this.client.complete_escrow({
        escrow_id: BigInt(escrowId),
      });

      return [tx.asOperation()];
    } catch (error) {
      this.logger.error(
        `Failed to create completion ops: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Creates operations for raising a dispute
   */
  async createDisputeOps(
    escrowId: string,
    callerPublicKey: string,
  ): Promise<StellarSdk.xdr.Operation[]> {
    try {
      this.logger.log(`Creating dispute ops for escrow ID: ${escrowId}`);

      const tx = await this.client.raise_dispute({
        escrow_id: BigInt(escrowId),
        caller: callerPublicKey,
      });

      return [tx.asOperation()];
    } catch (error) {
      this.logger.error(
        `Failed to create dispute ops: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Creates operations for resolving a dispute
   */
  async createResolveDisputeOps(
    escrowId: string,
    winnerPublicKey: string,
    splitWinnerAmount?: string,
  ): Promise<StellarSdk.xdr.Operation[]> {
    try {
      this.logger.log(
        `Creating resolve dispute ops for escrow ID: ${escrowId}`,
      );

      const tx = await this.client.resolve_dispute({
        escrow_id: BigInt(escrowId),
        winner: winnerPublicKey,
        split_winner_amount: splitWinnerAmount
          ? BigInt(splitWinnerAmount)
          : undefined,
      });

      return [tx.asOperation()];
    } catch (error) {
      this.logger.error(
        `Failed to create resolve dispute ops: ${this.getErrorMessage(error)}`,
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
      return String((error as Record<string, unknown>).message);
    }
    return 'Unknown error';
  }
}
