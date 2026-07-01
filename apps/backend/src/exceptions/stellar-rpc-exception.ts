import { HttpException, HttpStatus } from '@nestjs/common';

export abstract class StellarRpcException extends HttpException {
  public readonly code: string;
  public readonly category: 
    | 'timeout' 
    | 'transaction' 
    | 'account' 
    | 'network' 
    | 'validation';

  constructor(
    message: string,
    code: string,
    status: HttpStatus,
    category: 
      | 'timeout' 
      | 'transaction' 
      | 'account' 
      | 'network' 
      | 'validation',
    public readonly isRetryable: boolean = false,
  ) {
    super(message, status);
    this.code = code;
    this.category = category;
  }
}

export class StellarRpcTimeoutException extends StellarRpcException {
  constructor(message: string) {
    super(message, 'RPC_TIMEOUT', HttpStatus.GATEWAY_TIMEOUT, 'timeout', true);
  }
}

export class StellarRpcTransactionException extends StellarRpcException {
  constructor(message: string) {
    super(message, 'RPC_TRANSACTION_ERROR', HttpStatus.BAD_GATEWAY, 'transaction');
  }
}

export class StellarRpcAccountException extends StellarRpcException {
  constructor(message: string) {
    super(message, 'RPC_ACCOUNT_ERROR', HttpStatus.BAD_GATEWAY, 'account');
  }
}

export class StellarRpcNetworkException extends StellarRpcException {
  constructor(message: string) {
    super(message, 'RPC_NETWORK_ERROR', HttpStatus.BAD_GATEWAY, 'network', true);
  }
}

export class StellarRpcValidationException extends StellarRpcException {
  constructor(message: string) {
    super(message, 'RPC_VALIDATION_ERROR', HttpStatus.BAD_REQUEST, 'validation', false);
  }
}
