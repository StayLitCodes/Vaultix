import { StellarRpcException } from './stellar-rpc-exception.base';

export class StellarNetworkError extends StellarRpcException {
  readonly statusCode = 503;
  readonly isRetryable = true;

  constructor(message: string) {
    super(message, 'STELLAR_NETWORK', 503);
  }
}
