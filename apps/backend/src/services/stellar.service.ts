import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import stellarConfig from '../config/stellar.config';
import * as StellarSdk from '@stellar/stellar-sdk';
import { retryWithBackoff } from '../utils/retry.util';
import {
  StellarAccountResponse,
  StellarSubmitTransactionResponse,
  StellarTransactionResponse,
  StellarServer,
} from '../types/stellar.types';

@Injectable()
export class StellarService {
  private readonly logger = new Logger(StellarService.name);
  private server: StellarServer;
  private networkPassphrase: string;

  constructor(
    @Inject(stellarConfig.KEY)
    private config: ConfigType<typeof stellarConfig>,
  ) {
    this.networkPassphrase = this.config.networkPassphrase;
    this.server = new StellarSdk.Horizon.Server(this.config.horizonUrl);

    this.logger.log(
      `Initialized Stellar service for ${this.config.network} network`,
    );
    this.logger.log(`Horizon URL: ${this.config.horizonUrl}`);
  }

  /**
   * Retrieves account information from the Stellar network
   * @param publicKey The public key of the account to retrieve
   * @returns Account record with balance and sequence number
   */
  async getAccount(publicKey: string): Promise<StellarAccountResponse> {
    try {
      this.logger.log(`Fetching account info for: ${publicKey}`);

      /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
      const account: StellarAccountResponse = (await this.server
        .accounts()
        .accountId(publicKey)
        .call()) as StellarAccountResponse;
      /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
      this.logger.log(`Successfully retrieved account info for: ${publicKey}`);

      return account;
    } catch (error) {
      this.logger.error(
        `Failed to fetch account ${publicKey}: ${this.getErrorMessage(error)}`,
      );
      throw this.mapStellarError(error, `Error fetching account ${publicKey}`);
    }
  }

  /**
   * Builds a transaction with the provided operations
   * @param sourcePublicKey Public key of the source account
   * @param operations Array of operations to include in the transaction
   * @param memo Optional memo for the transaction
   * @param fee Optional fee override (in stroops)
   * @returns Built transaction object
   */
  async buildTransaction(
    sourcePublicKey: string,
    operations: StellarSdk.xdr.Operation[],
    memo?: StellarSdk.Memo,
    fee?: number,
  ): Promise<StellarSdk.Transaction> {
    try {
      this.logger.log(`Building transaction for account: ${sourcePublicKey}`);

      // Fetch the account to get the latest sequence number
      const account = await this.getAccount(sourcePublicKey);

      // Calculate fee if not provided (minimum 100 stroops per operation)
      const calculatedFee = fee || Math.max(100, operations.length * 100);

      // Create transaction builder
      const transactionBuilder = new StellarSdk.TransactionBuilder(account, {
        fee: calculatedFee.toString(),
        networkPassphrase: this.networkPassphrase,
      });

      // Add operations to the transaction
      for (const operation of operations) {
        transactionBuilder.addOperation(operation);
      }

      // Add memo if provided
      if (memo) {
        transactionBuilder.addMemo(memo);
      }

      const transaction = transactionBuilder.build();
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

  /**
   * Submits a transaction to the Stellar network with retry logic
   * @param transaction The transaction object to submit
   * @returns Transaction result
   */
  async submitTransaction(
    transaction: StellarSdk.Transaction,
  ): Promise<StellarSubmitTransactionResponse> {
    try {
      this.logger.log('Submitting transaction with retry logic');

      /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
      const result = await retryWithBackoff(
        async () => {
          const res = await this.server.submitTransaction(transaction, {
            skipMemoRequiredCheck: true,
          });
          return res;
        },
        this.config.maxRetries,
        this.config.retryDelay,
      );

      this.logger.log(`Successfully submitted transaction: ${result.hash}`);
      return result;
      /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
    } catch (error) {
      this.logger.error(
        `Failed to submit transaction after ${this.config.maxRetries + 1} attempts: ${this.getErrorMessage(error)}`,
      );
      throw this.mapStellarError(
        error,
        `Error submitting transaction after ${this.config.maxRetries + 1} attempts`,
      );
    }
  }

  /**
   * Streams transactions for a given account
   * @param accountId The account ID to stream transactions for
   * @param callback Callback function to handle incoming transactions
   * @returns EventSource object for stream control
   */
  streamTransactions(
    accountId: string,
    callback: (transaction: StellarTransactionResponse) => void,
  ): any {
    this.logger.log(`Starting transaction stream for account: ${accountId}`);

    const handler = (transaction: StellarTransactionResponse) => {
      this.logger.log(
        `Received transaction: ${transaction.id} for account: ${accountId}`,
      );
      callback(transaction);
    };

    // Create event stream for account transactions
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    const eventSource = this.server
      .transactions()
      .forAccount(accountId)
      .cursor('now')
      .stream({
        onmessage: handler,
      });
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

    this.logger.log(`Transaction stream established for account: ${accountId}`);
    return eventSource;
  }

  /**
   * Checks the status of a submitted transaction
   * @param transactionHash The hash of the transaction to check
   * @returns Transaction response if found, null otherwise
   */
  async checkTransactionStatus(
    transactionHash: string,
  ): Promise<StellarTransactionResponse | null> {
    try {
      this.logger.log(`Checking status for transaction: ${transactionHash}`);

      /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
      const transaction: StellarTransactionResponse = (await this.server
        .transactions()
        .transaction(transactionHash)
        .call()) as StellarTransactionResponse;
      /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

      this.logger.log(
        `Transaction ${transactionHash} status: ${transaction.successful ? 'SUCCESS' : 'FAILED'}`,
      );
      return transaction;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        // Transaction not found (possibly still pending)
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

  /**
   * Validates a Stellar public key
   * @param publicKey The public key to validate
   * @returns True if valid, false otherwise
   */
  isValidPublicKey(publicKey: string): boolean {
    try {
      return StellarSdk.StrKey.isValidEd25519PublicKey(publicKey);
    } catch {
      return false;
    }
  }

  /**
   * Validates a Stellar secret key
   * @param secretKey The secret key to validate
   * @returns True if valid, false otherwise
   */
  isValidSecretKey(secretKey: string): boolean {
    try {
      return StellarSdk.StrKey.isValidEd25519SecretSeed(secretKey);
    } catch {
      return false;
    }
  }

  /**
   * Creates a new Stellar keypair
   * @returns New keypair with public and private keys
   */
  createKeypair(): StellarSdk.Keypair {
    const keypair = StellarSdk.Keypair.random();
    this.logger.log(
      `Created new keypair with public key: ${keypair.publicKey()}`,
    );
    return keypair;
  }

  /**
   * Type guard to check if error has response with status
   */
  private isNotFoundError(error: unknown): boolean {
    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    return (
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      typeof (error as any).response === 'object' &&
      (error as any).response !== null &&
      'status' in (error as any).response &&
      (error as any).response.status === 404
    );
    /* eslint-enable @typescript-eslint/no-unsafe-member-access */
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

  /**
   * Maps Stellar SDK errors to more descriptive error messages
   * @param error The error to map
   * @param defaultMessage Default message if specific mapping isn't found
   * @returns Mapped error
   */
  private mapStellarError(error: unknown, defaultMessage: string): Error {
    if (!error) {
      return new Error(defaultMessage);
    }

    // Type guard for error objects
    if (typeof error === 'object' && error !== null) {
      // Check if it's a Horizon API error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const errorObj = error as any;
      /* eslint-disable @typescript-eslint/no-unsafe-member-access */
      if (errorObj.response?.data) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const problem = errorObj.response.data;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const title =
          problem.title || problem.extras?.result_codes?.transaction;

        if (problem.detail) {
          return new Error(
            `Stellar API Error: ${String(problem.detail)} (${String(title)})`,
          );
        }

        if (problem.extras?.result_codes) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const codes = problem.extras.result_codes;
          return new Error(
            `Stellar Transaction Error: ${JSON.stringify(codes)}`,
          );
        }
      }
      /* eslint-enable @typescript-eslint/no-unsafe-member-access */

      // Check for specific Stellar SDK error types
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      if (errorObj.constructor?.name?.includes('NetworkError')) {
        return new Error(
          `Network Error: Failed to connect to Stellar network (${this.getErrorMessage(error)})`,
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      if (errorObj.constructor?.name?.includes('NotFoundError')) {
        return new Error(`Not Found: ${this.getErrorMessage(error)}`);
      }

      return new Error(`${defaultMessage}: ${this.getErrorMessage(error)}`);
    }

    return new Error(defaultMessage);
  }
}
