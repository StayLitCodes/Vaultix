import { StellarRpcException } from './stellar-rpc-exception.base';

export class StellarAccountError extends StellarRpcException {
  readonly statusCode = 404;
  readonly isRetryable = false;

  constructor(message: string) {
    super(message, 'STELLAR_ACCOUNT', 404);
  }
}
