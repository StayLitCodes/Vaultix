import * as StellarSdk from '@stellar/stellar-sdk';
import { Injectable, Logger } from '@nestjs/common';
import { normalizeMetadataHash } from '../../modules/escrow/utils/metadata-hash.util';
import { validateSorobanU64 } from '../../modules/escrow/utils/soroban-u64.util';
import { decimalToBaseUnits, I128_MAX } from '../../modules/escrow/amount.util';

@Injectable()
export class EscrowOperationsService {
  private readonly logger = new Logger(EscrowOperationsService.name);

  private readonly contractId: string;

  private u64(value: string): StellarSdk.xdr.Uint64 {
    return new StellarSdk.xdr.Uint64(validateSorobanU64(value));
  }

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
    metadataReference: string,
    decimals = 7,
  ): StellarSdk.xdr.Operation[] {
    try {
      this.logger.log(
        `Creating escrow initialization ops for escrow ID: ${escrowId}`,
      );

      const contract = new StellarSdk.Contract(this.contractId);
      const metadataHash = Buffer.from(
        normalizeMetadataHash(metadataReference),
        'hex',
      );

      const milestoneVec = StellarSdk.xdr.ScVal.scvVec(
        milestones.map((m) =>
          StellarSdk.xdr.ScVal.scvMap([
            new StellarSdk.xdr.ScMapEntry({
              key: StellarSdk.xdr.ScVal.scvSymbol('amount'),
              val: StellarSdk.xdr.ScVal.scvI128(
                new StellarSdk.xdr.Int128Parts({
                  lo: new StellarSdk.xdr.Uint64(
                    (
                      decimalToBaseUnits(m.amount, decimals) &
                      ((1n << 64n) - 1n)
                    ).toString(),
                  ),
                  hi: new StellarSdk.xdr.Int64(
                    (decimalToBaseUnits(m.amount, decimals) >> 64n).toString(),
                  ),
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
        StellarSdk.xdr.ScVal.scvU64(this.u64(escrowId)),
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
        StellarSdk.xdr.ScVal.scvBytes(metadataHash),
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
        StellarSdk.xdr.ScVal.scvU64(this.u64(escrowId)),
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
        StellarSdk.xdr.ScVal.scvU64(this.u64(escrowId)),
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
        StellarSdk.xdr.ScVal.scvU64(this.u64(escrowId)),
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
        StellarSdk.xdr.ScVal.scvU64(this.u64(escrowId)),
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
        StellarSdk.xdr.ScVal.scvU64(this.u64(escrowId)),
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
        StellarSdk.xdr.ScVal.scvU64(this.u64(escrowId)),
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
   * Creates operations for resolving a dispute.
   *
   * Mirrors the on-chain `resolve_dispute(escrow_id, winner,
   * split_winner_amount, resolution_evidence_hash)` entrypoint. Both optional
   * arguments are encoded with the contract's actual types so that neither is
   * silently dropped: `Option<i128>` carries a base-unit i128 and
   * `Option<BytesN<32>>` carries a raw sha2-256 digest.
   */
  createResolveDisputeOps(
    escrowId: string,
    winnerPublicKey: string,
    splitWinnerAmount?: string,
    resolutionEvidenceHash?: string,
  ): StellarSdk.xdr.Operation[] {
    try {
      this.logger.log(
        `Creating resolve dispute ops for escrow ID: ${escrowId}`,
      );

      const splitAmount = this.encodeOptionalSplitAmount(splitWinnerAmount);
      const evidenceHash = this.encodeOptionalEvidenceHash(
        resolutionEvidenceHash,
      );

      const contract = new StellarSdk.Contract(this.contractId);
      const op = contract.call(
        'resolve_dispute',
        StellarSdk.xdr.ScVal.scvU64(this.u64(escrowId)),
        new StellarSdk.Address(winnerPublicKey).toScVal(),
        splitAmount,
        evidenceHash,
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
   * Encodes `Option<i128>` for the split amount using the contract type.
   * Accepts a decimal base-unit string; rejects malformed or out-of-range
   * values instead of coercing them.
   */
  private encodeOptionalSplitAmount(
    splitWinnerAmount?: string,
  ): StellarSdk.xdr.ScVal {
    if (
      splitWinnerAmount === undefined ||
      splitWinnerAmount === null ||
      splitWinnerAmount === ''
    ) {
      return StellarSdk.xdr.ScVal.scvVec([]);
    }

    const normalized = String(splitWinnerAmount).trim();
    if (!/^\d+$/.test(normalized)) {
      throw new Error('split amount must be a non-negative integer string');
    }

    const units = BigInt(normalized);
    if (units > I128_MAX) {
      throw new Error('split amount is outside the supported i128 range');
    }

    const lo = units & ((1n << 64n) - 1n);
    const hi = units >> 64n;

    return StellarSdk.xdr.ScVal.scvVec([
      StellarSdk.xdr.ScVal.scvI128(
        new StellarSdk.xdr.Int128Parts({
          lo: new StellarSdk.xdr.Uint64(lo.toString()),
          hi: new StellarSdk.xdr.Int64(hi.toString()),
        }),
      ),
    ]);
  }

  /**
   * Encodes `Option<BytesN<32>>` for the resolution evidence hash. Accepts a
   * raw 32-byte sha2-256 digest as hex (or a CID/IPFS reference) and reuses the
   * existing digest normalizer so malformed evidence is rejected.
   */
  private encodeOptionalEvidenceHash(
    resolutionEvidenceHash?: string,
  ): StellarSdk.xdr.ScVal {
    if (
      resolutionEvidenceHash === undefined ||
      resolutionEvidenceHash === null ||
      resolutionEvidenceHash.trim() === ''
    ) {
      return StellarSdk.xdr.ScVal.scvVec([]);
    }

    const digest = normalizeMetadataHash(resolutionEvidenceHash.trim());

    return StellarSdk.xdr.ScVal.scvVec([
      StellarSdk.xdr.ScVal.scvBytes(Buffer.from(digest, 'hex')),
    ]);
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
