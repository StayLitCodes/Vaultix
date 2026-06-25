import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import stellarConfig from './config/stellar.config';
import { StellarRpcIntegrationService } from './rpc/stellar-rpc-integration.service';
import {
  StellarAccountResponse,
  StellarSubmitTransactionResponse,
  StellarTransactionResponse,
} from './types/stellar.types';
import * as StellarSdk from '@stellar/stellar-sdk';

@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);

  constructor(
    @Inject(stellarConfig.KEY)
    private config: ConfigType<typeof stellarConfig>,
    private readonly stellarRpcService: StellarRpcIntegrationService,
  ) {}

  async getAccount(publicKey: string): Promise<StellarAccountResponse> {
    try {
      this.logger.log(`Fetching account info for: ${publicKey}`);
      const response = await this.stellarRpcService.getAccount(publicKey);
      this.logger.log(`Successfully retrieved account info for: ${publicKey}`);
      return response;
    } catch (error) {
      this.logger.error(
        `Failed to fetch account ${publicKey}: ${this.getErrorMessage(error)}`,
      );
      throw this.mapStellarError(error, `Error fetching account ${publicKey}`);
    }
  }

  async validateAsset(code: string, issuer: string): Promise<boolean> {
    try {
      this.logger.log(`Validating asset: ${code} from ${issuer}`);
      const isValid = await this.stellarRpcService.validateAsset(code, issuer);
      return isValid;
    } catch (error) {
      this.logger.error(
        `Failed to validate asset ${code}: ${this.getErrorMessage(error)}`,
      );
      return false;
    }
  }

  async buildTransaction(
    sourcePublicKey: string,
    operations: StellarSdk.xdr.Operation[],
    memo?: StellarSdk.Memo,
    fee?: number,
  ): Promise<StellarSdk.Transaction> {
    try {
      this.logger.log(`Building transaction for account: ${sourcePublicKey}`);
      const transaction = await this.stellarRpcService.buildTransaction(
        sourcePublicKey,
        operations,
        memo,
        fee,
      );
      this.logger.log(
        `Successfully built transaction with hash: ${transaction.hash().toString('hex')}`,
      );
      return transaction;
    } catch (error) {
      this.logger.error(
        `Failed to build transaction for account ${sourcePublicKey}: ${this.getErrorMessage(error)}`,
      );
      throw this.mapStellarError(
        error,
        `Error building transaction for account ${sourcePublicKey}`,
      );
    }
  }

  async submitTransaction(
    transaction: StellarSdk.Transaction,
  ): Promise<StellarSubmitTransactionResponse> {
    try {
      this.logger.log('Submitting transaction with retry logic');
      const result = await this.stellarRpcService.submitTransaction(transaction);
      this.logger.log(`Successfully submitted transaction: ${result.hash}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to submit transaction: ${this.getErrorMessage(error)}`,
      );
      throw this.mapStellarError(error, 'Error submitting transaction');
    }
  }

  streamTransactions(
    accountId: string,
    callback: (transaction: StellarTransactionResponse) => void,
  ) {
    return this.stellarRpcService.streamTransactions(accountId, callback);
  }

  async checkTransactionStatus(transactionHash: string): Promise<StellarTransactionResponse | null> {
    try {
      this.logger.log(`Checking status for transaction: ${transactionHash}`);
      const transaction = await this.stellarRpcService.checkTransactionStatus(transactionHash);
      this.logger.log(
        `Transaction ${transactionHash} status: ${transaction?.successful ? 'SUCCESS' : 'FAILED'}`,
      );
      return transaction;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        this.logger.log(
          `Transaction ${transactionHash} not found (may still be pending)`,
        );
        return null;
      }
      this.logger.error(
        `Failed to check transaction status ${transactionHash}: ${this.getErrorMessage(error)}`,
      );
      throw this.mapStellarError(
        error,
        `Error checking transaction status ${transactionHash}`,
      );
    }
  }

  isValidPublicKey(publicKey: string): boolean {
    return StellarSdk.StrKey.isValidEd25519PublicKey(publicKey);
  }

  isValidSecretKey(secretKey: string): boolean {
    return StellarSdk.StrKey.isValidEd25519SecretSeed(secretKey);
  }

  createKeypair(): StellarSdk.Keypair {
    const keypair = StellarSdk.Keypair.random();
    this.logger.log(`Created new keypair with public key: ${keypair.publicKey()}`);
    return keypair;
  }

  async getAccountInfo(publicKey: string): Promise<StellarAccountResponse> {
    return this.getAccount(publicKey);
  }

  async getTransaction(txHash: string): Promise<StellarTransactionResponse | null> {
    return this.checkTransactionStatus(txHash);
  }

  private isNotFoundError(error: unknown): boolean {
    if (typeof error !== 'object' || !error) return false;
    if ('statusCode' in error && error.statusCode === 404) return true;
    if ('name' in error && error.name === 'NotFoundError') return true;
    return false;
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

  private mapStellarError(error: unknown, defaultMessage: string): Error {
    if (!error) {
      return new Error(defaultMessage);
    }
    if (typeof error === 'object' && error !== null) {
      const errorObj = error as any;
      if (errorObj.response?.data) {
        const problem = errorObj.response.data;
        const title = problem.title || problem.extras?.result_codes?.transaction;
        if (problem.detail) {
          return new Error(`Stellar API Error: ${String(problem.detail)} (${String(title)})`);
        }
        if (problem.extras?.result_codes) {
          const codes = problem.extras.result_codes;
          return new Error(`Stellar Transaction Error: ${JSON.stringify(codes)}`);
        }
      }
      if (errorObj.constructor?.name?.includes('NetworkError')) {
        return new Error(`Network Error: Failed to connect to Stellar network (${this.getErrorMessage(error)})`);
      }
      if (errorObj.constructor?.name?.includes('NotFoundError')) {
        return new Error(`Not Found: ${this.getErrorMessage(error)}`);
      }
      return new Error(`${defaultMessage}: ${this.getErrorMessage(error)}`);
    }
    return new Error(defaultMessage);
  }
}
