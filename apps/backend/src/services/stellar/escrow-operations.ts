import * as StellarSdk from '@stellar/stellar-sdk';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EscrowOperationsService {
  private readonly logger = new Logger(EscrowOperationsService.name);

  private readonly contractId: string;

  constructor() {
    this.contractId = process.env.STELLAR_CONTRACT_ID || '';
  }

  /**
   * Creates operations for initializing an escrow contract
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

      const contract = new StellarSdk.Contract(this.contractId);

      const milestoneVec = StellarSdk.xdr.ScVal.scvVec(
        milestones.map((m) =>
          StellarSdk.xdr.ScVal.scvMap([
            new StellarSdk.xdr.ScMapEntry({
              key: StellarSdk.xdr.ScVal.scvSymbol('amount'),
              val: StellarSdk.xdr.ScVal.scvI128(
                new StellarSdk.xdr.Int128Parts({
                  lo: new StellarSdk.xdr.Uint64(m.amount),
                  hi: new StellarSdk.xdr.Int64('0'),
                }),
              ),
            }),
            new StellarSdk.xdr.ScMapEntry({
              key: StellarSdk.xdr.ScVal.scvSymbol('description'),
              val: StellarSdk.xdr.ScVal.scvSymbol(
                m.description.replace(/\s+/g, '_'),
              ),
            }),
            new StellarSdk.xdr.ScMapEntry({
              key: StellarSdk.xdr.ScVal.scvSymbol('status'),
              val: StellarSdk.xdr.ScVal.scvSymbol('Pending'),
            }),
          ]),
        ),
      );

      const op = contract.call(
        'create_escrow',
        StellarSdk.xdr.ScVal.scvU64(new StellarSdk.xdr.Uint64(escrowId)),
        new StellarSdk.Address(depositorPublicKey).toScVal(),
        new StellarSdk.Address(recipientPublicKey).toScVal(),
        new StellarSdk.Address(
          tokenAddress === 'native'
            ? 'CDLZFC3SYJYDZT7K67VZ75YJFCGSN5W4B77T2YI2EHCWH6I6D6LNCU6B' /* Native XLM Token Contract in Testnet */
            : tokenAddress,
        ).toScVal(),
        milestoneVec,
        StellarSdk.xdr.ScVal.scvU64(
          new StellarSdk.xdr.Uint64(deadline.toString()),
        ),
      );

      return [op];
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
  createFundingOps(
    escrowId: string,
    // amount: string, // Not used in contract call directly as it's part of escrow creation
    // asset: StellarSdk.Asset,
  ): StellarSdk.xdr.Operation[] {
    try {
      this.logger.log(`Creating funding ops for escrow ID: ${escrowId}`);

      const contract = new StellarSdk.Contract(this.contractId);
      const op = contract.call(
        'deposit_funds',
        StellarSdk.xdr.ScVal.scvU64(new StellarSdk.xdr.Uint64(escrowId)),
      );

      return [op];
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
  createMilestoneReleaseOps(
    escrowId: string,
    milestoneId: number,
    // releaserPublicKey: string,
    // recipientPublicKey: string,
    // amount: string,
    // asset: StellarSdk.Asset,
  ): StellarSdk.xdr.Operation[] {
    try {
      this.logger.log(
        `Creating milestone release ops for escrow ID: ${escrowId}, milestone: ${milestoneId}`,
      );

      const contract = new StellarSdk.Contract(this.contractId);
      const op = contract.call(
        'release_milestone',
        StellarSdk.xdr.ScVal.scvU64(new StellarSdk.xdr.Uint64(escrowId)),
        StellarSdk.xdr.ScVal.scvU32(milestoneId),
      );

      return [op];
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
  createConfirmationOps(
    escrowId: string,
    confirmerPublicKey: string,
    milestoneId: number,
  ): StellarSdk.xdr.Operation[] {
    try {
      this.logger.log(
        `Creating confirmation ops for escrow ID: ${escrowId}, milestone: ${milestoneId}`,
      );

      const contract = new StellarSdk.Contract(this.contractId);
      const op = contract.call(
        'confirm_delivery',
        StellarSdk.xdr.ScVal.scvU64(new StellarSdk.xdr.Uint64(escrowId)),
        StellarSdk.xdr.ScVal.scvU32(milestoneId),
        new StellarSdk.Address(confirmerPublicKey).toScVal(),
      );

      return [op];
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
  createCancelOps(
    escrowId: string,
    // cancellerPublicKey: string,
  ): StellarSdk.xdr.Operation[] {
    try {
      this.logger.log(`Creating cancel ops for escrow ID: ${escrowId}`);

      const contract = new StellarSdk.Contract(this.contractId);
      const op = contract.call(
        'cancel_escrow',
        StellarSdk.xdr.ScVal.scvU64(new StellarSdk.xdr.Uint64(escrowId)),
      );

      return [op];
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
  createCompletionOps(
    escrowId: string,
    // completerPublicKey: string,
  ): StellarSdk.xdr.Operation[] {
    try {
      this.logger.log(`Creating completion ops for escrow ID: ${escrowId}`);

      const contract = new StellarSdk.Contract(this.contractId);
      const op = contract.call(
        'complete_escrow',
        StellarSdk.xdr.ScVal.scvU64(new StellarSdk.xdr.Uint64(escrowId)),
      );

      return [op];
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
  createDisputeOps(
    escrowId: string,
    callerPublicKey: string,
  ): StellarSdk.xdr.Operation[] {
    try {
      this.logger.log(`Creating dispute ops for escrow ID: ${escrowId}`);

      const contract = new StellarSdk.Contract(this.contractId);
      const op = contract.call(
        'raise_dispute',
        StellarSdk.xdr.ScVal.scvU64(new StellarSdk.xdr.Uint64(escrowId)),
        new StellarSdk.Address(callerPublicKey).toScVal(),
      );

      return [op];
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
  createResolveDisputeOps(
    escrowId: string,
    winnerPublicKey: string,
    splitWinnerAmount?: string,
  ): StellarSdk.xdr.Operation[] {
    try {
      this.logger.log(
        `Creating resolve dispute ops for escrow ID: ${escrowId}`,
      );

      const contract = new StellarSdk.Contract(this.contractId);
      const op = contract.call(
        'resolve_dispute',
        StellarSdk.xdr.ScVal.scvU64(new StellarSdk.xdr.Uint64(escrowId)),
        new StellarSdk.Address(winnerPublicKey).toScVal(),
        splitWinnerAmount
          ? StellarSdk.xdr.ScVal.scvVec([
              StellarSdk.xdr.ScVal.scvI128(
                new StellarSdk.xdr.Int128Parts({
                  lo: new StellarSdk.xdr.Uint64(splitWinnerAmount),
                  hi: new StellarSdk.xdr.Int64('0'),
                }),
              ),
            ])
          : StellarSdk.xdr.ScVal.scvVec([]), // Option::None
      );

      return [op];
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      return String((error as any).message);
    }
    return 'Unknown error';
  }
}
