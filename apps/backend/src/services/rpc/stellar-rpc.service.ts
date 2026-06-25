import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import stellarConfig from '../../config/stellar.config';
import { StellarRpcClient } from './stellar-rpc-client.service';
import {
  StellarRpcResponse,
  StellarRpcHealthResponse,
} from '../types/rpc/stellar-rpc.types';
import {
  StellarAccountResponse,
  StellarSubmitTransactionResponse,
  StellarTransactionResponse,
} from '../types/stellar.types';
import {
  StellarTimeoutError,
  StellarNetworkError,
  StellarTransactionError,
  StellarAccountError,
} from '../errors';

@Injectable()
export class StellarRpcService implements OnModuleInit {
  private readonly logger = new Logger(StellarRpcService.name);
  private rpcClient!: StellarRpcClient;

  constructor(
    @Inject(stellarConfig.KEY)
    private config: ConfigType<typeof stellarConfig>,
  ) {}

  onModuleInit() {
    this.rpcClient = new StellarRpcClient(this.config);
  }

  async getAccount(publicKey: string): Promise<StellarRpcResponse<StellarAccountResponse>> {
    this.logger.log(`RPC: Fetching account info for: ${publicKey}`);

    const operation = () =>
      this.createStellarServer()
        .accounts()
        .accountId(publicKey)
        .call();

    const response = await this.rpcClient.executeWithRetry(
      operation,
      `getAccount(${publicKey})`,
    );

    if (!response.success) {
      throw response.error;
    }

    this.logger.log(`RPC: Successfully retrieved account info for: ${publicKey}`);
    return response;
  }

  async validateAsset(code: string, issuer: string): Promise<StellarRpcResponse<boolean>> {
    this.logger.log(`RPC: Validating asset: ${code} from ${issuer}`);

    const operation = () =>
      this.createStellarServer()
        .assets()
        .forCode(code)
        .forIssuer(issuer)
        .call();

    const response = await this.rpcClient.executeWithRetry(
      operation,
      `validateAsset(${code}, ${issuer})`,
    );

    if (!response.success) {
      this.logger.warn(`RPC: Asset validation failed: ${response.error?.message}`);
      return response;
    }

    const result = response.data as any;
    this.logger.log(`RPC: Asset validation result: ${result.records.length > 0} for ${code}`);
    return {
      data: result.records.length > 0,
      success: true,
      latency: response.latency,
    };
  }

  async buildTransaction(
    sourcePublicKey: string,
    operations: any[],
    memo?: any,
    fee?: number,
  ): Promise<StellarRpcResponse<StellarSdk.Transaction>> {
    this.logger.log(`RPC: Building transaction for account: ${sourcePublicKey}`);

    const operation = async () => {
      const account = await this.getAccount(sourcePublicKey).then((response) => response.data);

      const calculatedFee = fee || Math.max(100, operations.length * 100);

      const transactionBuilder = new StellarSdk.TransactionBuilder(account, {
        fee: calculatedFee.toString(),
        networkPassphrase: this.config.networkPassphrase,
      });

      for (const operation of operations) {
        transactionBuilder.addOperation(operation);
      }

      if (memo) {
        transactionBuilder.addMemo(memo);
      }

      return transactionBuilder.build();
    };

    const response = await this.rpcClient.executeWithRetry(
      operation,
      `buildTransaction(${sourcePublicKey})`,
    );

    if (!response.success) {
      throw response.error;
    }

    this.logger.log(`RPC: Transaction built with hash: ${response.data.hash().toString('hex')}`);
    return response;
  }

  async submitTransaction(
    transaction: any,
  ): Promise<StellarRpcResponse<StellarSubmitTransactionResponse>> {
    this.logger.log('RPC: Submitting transaction with retry logic');

    const operation = () =>
      this.createStellarServer().submitTransaction(transaction, {
        skipMemoRequiredCheck: true,
      });

    const response = await this.rpcClient.executeWithRetry(
      operation,
      `submitTransaction(${transaction.hash().toString('hex')})`,
    );

    if (!response.success) {
      throw response.error;
    }

    this.logger.log(`RPC: Successfully submitted transaction: ${response.data.hash}`);
    return response;
  }

  async checkTransactionStatus(
    transactionHash: string,
  ): Promise<StellarRpcResponse<StellarTransactionResponse | null>> {
    this.logger.log(`RPC: Checking status for transaction: ${transactionHash}`);

    const operation = () =>
      this.createStellarServer()
        .transactions()
        .transaction(transactionHash)
        .call();

    const response = await this.rpcClient.executeWithRetry(
      operation,
      `checkTransactionStatus(${transactionHash})`,
    );

    if (!response.success) {
      if (this.isNotFoundError(response.error)) {
        this.logger.log(
          `RPC: Transaction ${transactionHash} not found (may still be pending)`,
        );
        return {
          data: null,
          success: true,
          latency: response.latency,
        };
      }
      throw response.error;
    }

    this.logger.log(
      `RPC: Transaction ${transactionHash} status: ${response.data.successful ? 'SUCCESS' : 'FAILED'}`,
    );
    return response;
  }

  private createStellarServer(): any {
    return new StellarSdk.Horizon.Server(this.config.horizonUrl);
}

  private isNotFoundError(error: unknown): boolean {
    if (typeof error !== 'object' || !error) return false;
    if ('statusCode' in error && error.statusCode === 404) return true;
    if ('name' in error && error.name === 'NotFoundError') return true;
    return false;
  }

  async getHealthStatus(): Promise<StellarRpcHealthResponse> {
    const startTime = Date.now();
    const horizonServer = this.createStellarServer();

    try {
      const ledgerInfo = await horizonServer.ledger().call();

      const health: StellarRpcHealthResponse = {
        status: 'healthy',
        horizon: {
          lastLedger: ledgerInfo.sequence,
          peers: ledgerInfo._links?.peer_count?.href ? 1 : 0,
          network: this.config.network,
        },
        timestamp: new Date().toISOString(),
      };

      return {
        ...health,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`Health check failed: ${this.getErrorMessage(error)}`);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        latency: Date.now() - startTime,
      };
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'object' && error !== null && 'message' in error) {
      return String(error.message);
    }
    return 'Unknown error';
  }

  async reset() {
    this.rpcClient.resetCircuit();
    this.logger.log('RPC client reset completed');
  }

  getCircuitState() {
    return this.rpcClient.getCircuitState();
  }

  getFailures() {
    return this.rpcClient.getFailures();
  }
}
