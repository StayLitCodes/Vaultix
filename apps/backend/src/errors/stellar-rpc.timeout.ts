import { StellarRpcException } from './stellar-rpc-exception.base';

export class StellarTimeoutError extends StellarRpcException {
  readonly statusCode = 408;
  readonly isRetryable = true;

  constructor(message: string) {
    super(message, 'STELLAR_TIMEOUT', 408);
  }
}
