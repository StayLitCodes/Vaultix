import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import stellarConfig from '../config/stellar.config';
import { StellarRpcService as RpcService } from './rpc/stellar-rpc.service';
import {
  StellarTimeoutError,
  StellarNetworkError,
  StellarTransactionError,
  StellarAccountError,
} from '../errors';

@Injectable()
export class StellarService {
  constructor(
    @Inject(stellarConfig.KEY)
    private config: ConfigType<typeof stellarConfig>,
    private readonly stellarRpcService: RpcService,
  ) {
    this.stellarRpcService.onModuleInit();
    this.logger.log(
      `Initialized Stellar service (RPC) for ${this.config.network} network`,
    );
    this.logger.log(`Horizon URL: ${this.config.horizonUrl}`);
  }

  private readonly logger = new Logger(StellarService.name);

  async getAccount(publicKey: string) {
    const response = await this.stellarRpcService.getAccount(publicKey);
    return response.data;
  }

  async validateAsset(code: string, issuer: string) {
    const response = await this.stellarRpcService.validateAsset(code, issuer);
    return response.data;
  }

  async buildTransaction(
    sourcePublicKey: string,
    operations: any[],
    memo?: any,
    fee?: number,
  ) {
    const response = await this.stellarRpcService.buildTransaction(
      sourcePublicKey,
      operations,
      memo,
      fee,
    );
    return response.data;
  }

  async submitTransaction(transaction: any) {
    const response = await this.stellarRpcService.submitTransaction(transaction);
    return response.data;
  }

  streamTransactions(
    accountId: string,
    callback: (transaction: any) => void,
  ) {
    return this.stellarRpcService.streamTransactions(accountId, callback);
  }

  async checkTransactionStatus(transactionHash: string) {
    const response = await this.stellarRpcService.checkTransactionStatus(transactionHash);
    return response.data;
  }

  isValidPublicKey(publicKey: string): boolean {
    return StellarSdk.StrKey.isValidEd25519PublicKey(publicKey);
  }

  isValidSecretKey(secretKey: string): boolean {
    return StellarSdk.StrKey.isValidEd25519SecretSeed(secretKey);
  }

  createKeypair(): StellarSdk.Keypair {
    const keypair = StellarSdk.Keypair.random();
    this.logger.log(
      `Created new keypair with public key: ${keypair.publicKey()}`,
    );
    return keypair;
  }

  async getHealthStatus() {
    return this.stellarRpcService.getHealthStatus();
  }

  async resetCircuit() {
    return this.stellarRpcService.reset();
  }

  getCircuitState() {
    return this.stellarRpcService.getCircuitState();
  }

  getFailures() {
    return this.stellarRpcService.getFailures();
  }
}
