import { StellarRpcException } from './stellar-rpc-exception.base';

export class StellarTransactionError extends StellarRpcException {
  readonly statusCode = 400;
  readonly isRetryable = false;

  constructor(message: string) {
    super(message, 'STELLAR_TRANSACTION', 400);
  }
}
