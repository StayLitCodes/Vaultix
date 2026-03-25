import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import stellarConfig from '../../config/stellar.config';

export interface OnchainEscrow {
  status: string;
  amount: string;
  depositor: string;
  recipient: string;
}

@Injectable()
export class SorobanClientService {
  private readonly logger = new Logger(SorobanClientService.name);
  private rpcServer: StellarSdk.rpc.Server;
  private networkPassphrase: string;
  private contractId: string;

  constructor(
    @Inject(stellarConfig.KEY)
    private config: ConfigType<typeof stellarConfig>,
  ) {
    const rpcUrl =
      process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
    this.rpcServer = new StellarSdk.rpc.Server(rpcUrl);
    this.networkPassphrase = this.config.networkPassphrase;
    this.contractId = process.env.STELLAR_CONTRACT_ID || '';

    this.logger.log(`Initialized Soroban client with RPC: ${rpcUrl}`);
  }

  /**
   * Fetches the current state of an escrow from the contract storage
   */
  async getEscrow(escrowId: number): Promise<OnchainEscrow | null> {
    try {
      this.logger.debug(`Fetching escrow ${escrowId} from contract`);

      const contract = new StellarSdk.Contract(this.contractId);

      // Get storage key for escrow: (Symbol("escrow"), u64)
      const key = StellarSdk.xdr.ScVal.scvVec([
        StellarSdk.xdr.ScVal.scvSymbol('escrow'),
        StellarSdk.xdr.ScVal.scvU64(
          new StellarSdk.xdr.Uint64(escrowId.toString()),
        ),
      ]);

      const ledgerKey = StellarSdk.xdr.LedgerKey.contractData(
        new StellarSdk.xdr.LedgerKeyContractData({
          contract: contract.address().toScAddress(),
          key,
          durability: StellarSdk.xdr.ContractDataDurability.persistent(),
        }),
      );

      const response = await this.rpcServer.getLedgerEntries(ledgerKey);

      if (!response.entries || response.entries.length === 0) {
        return null;
      }

      const entry = response.entries[0];
      const scVal = StellarSdk.xdr.ScVal.fromXDR(entry.val.toXDR());

      // Basic decoding (simplified for this task)
      // In a real app, use a proper ScVal decoder or the contract-client
      return this.decodeEscrowScVal(scVal);
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Error fetching escrow: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Decodes an ScVal representing the Escrow struct
   */
  private decodeEscrowScVal(scVal: StellarSdk.xdr.ScVal): OnchainEscrow | null {
    if (scVal.switch() !== StellarSdk.xdr.ScValType.scvMap()) {
      return null;
    }

    const map = scVal.map();
    if (!map) {
      return null;
    }

    const result: Partial<OnchainEscrow> = {};

    map.forEach((entry) => {
      const key = entry.key().sym().toString();
      const val = entry.val();

      // Simplified decoding for status and amount
      if (key === 'status') {
        result.status = this.decodeStatus(val);
      } else if (key === 'total_amount') {
        result.amount = val.i128().lo().toString(); // Simplified i128 handle
      } else if (key === 'depositor') {
        result.depositor = StellarSdk.Address.fromScAddress(
          val.address(),
        ).toString();
      } else if (key === 'recipient') {
        result.recipient = StellarSdk.Address.fromScAddress(
          val.address(),
        ).toString();
      }
    });

    return result as OnchainEscrow;
  }

  private decodeStatus(val: StellarSdk.xdr.ScVal): string {
    // EscrowStatus enum decoding
    if (val.switch() === StellarSdk.xdr.ScValType.scvVec()) {
      const vec = val.vec();
      if (vec && vec.length > 0) {
        return vec[0].sym().toString();
      }
    }
    // If it's just a symbol (some SDK versions/encodings)
    if (val.switch() === StellarSdk.xdr.ScValType.scvSymbol()) {
      return val.sym().toString();
    }
    return 'Unknown';
  }

  getContractId(): string {
    return this.contractId;
  }

  getRpc(): StellarSdk.rpc.Server {
    return this.rpcServer;
  }

  /**
   * Decodes contract-specific error codes from Soroban XDR
   */
  decodeContractError(errorCode: number): string {
    const errorMap: Record<number, string> = {
      1: 'EscrowNotFound',
      2: 'EscrowAlreadyExists',
      3: 'AlreadyFunded',
      4: 'NotFunded',
      5: 'InvalidMilestone',
      6: 'MilestoneAlreadyReleased',
      7: 'MilestoneNotReady',
      8: 'NotDepositor',
      9: 'NotArbiter',
      10: 'UnauthorizedAccess',
      11: 'InsufficientFunds',
      12: 'DeadlinePassed',
      13: 'DeadlineNotPassed',
      14: 'EscrowCompleted',
      15: 'EscrowCancelled',
      16: 'MilestoneNotReleased',
      17: 'EscrowNotActive',
      18: 'InvalidAmount',
    };

    return errorMap[errorCode] || `UnknownError(${errorCode})`;
  }
}
