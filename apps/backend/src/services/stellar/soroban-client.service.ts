import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import { Client as ContractClient, Escrow as OnchainEscrowRaw, Errors as ContractErrors } from 'contract-bindings';
import stellarConfig from '../../config/stellar.config';

export interface OnchainEscrow {
  status: string;
  amount: string;
  depositor: string;
  recipient: string;
  milestones?: any[];
  totalReleased?: string;
}

@Injectable()
export class SorobanClientService {
  private readonly logger = new Logger(SorobanClientService.name);
  private rpcServer: StellarSdk.rpc.Server;
  private networkPassphrase: string;
  private contractId: string;
  private client: ContractClient;

  constructor(
    @Inject(stellarConfig.KEY)
    private config: ConfigType<typeof stellarConfig>,
  ) {
    const rpcUrl =
      process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
    this.rpcServer = new StellarSdk.rpc.Server(rpcUrl);
    this.networkPassphrase = this.config.networkPassphrase;
    this.contractId = process.env.STELLAR_CONTRACT_ID || '';

    this.client = new ContractClient({
      rpcUrl,
      networkPassphrase: this.networkPassphrase,
      contractId: this.contractId,
      allowHttp: true,
    });

    this.logger.log(`Initialized Soroban client with RPC: ${rpcUrl}`);
  }

  /**
   * Fetches the current state of an escrow from the contract storage
   */
  async getEscrow(escrowId: number): Promise<OnchainEscrow | null> {
    try {
      this.logger.debug(`Fetching escrow ${escrowId} from contract`);

      const tx = await this.client.get_escrow({ escrow_id: BigInt(escrowId) });
      const result = await tx.simulate();

      if (!result || !result.result || !result.result.unwrap) {
        this.logger.warn(`Escrow ${escrowId} not found or simulation failed`);
        return null;
      }

      const rawEscrow = result.result.unwrap() as OnchainEscrowRaw;
      return this.mapOnchainEscrow(rawEscrow);
    } catch (error) {
      this.logger.error(
        `Error fetching escrow ${escrowId}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private mapOnchainEscrow(raw: OnchainEscrowRaw): OnchainEscrow {
    return {
      status: raw.status.tag,
      amount: raw.total_amount.toString(),
      depositor: raw.depositor,
      recipient: raw.recipient,
      milestones: raw.milestones.map((m) => ({
        amount: m.amount.toString(),
        description: m.description,
        status: m.status.tag,
      })),
      totalReleased: raw.total_released.toString(),
    };
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
    const errorEntry = (ContractErrors as any)[errorCode];
    return errorEntry ? errorEntry.message : `UnknownError(${errorCode})`;
  }
}
