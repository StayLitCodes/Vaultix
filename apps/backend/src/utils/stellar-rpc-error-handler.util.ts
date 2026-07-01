import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CircuitBreaker, CircuitBreakerConfig } from './circuit-breaker.util';
import { 
  StellarRpcException,
  StellarRpcTimeoutException,
  StellarRpcTransactionException,
  StellarRpcAccountException,
  StellarRpcNetworkException,
  StellarRpcValidationException
} from './stellar-rpc-exception';

@Injectable()
export class StellarRpcErrorHandler {
  private readonly logger = new Logger(StellarRpcErrorHandler.name);
  private readonly circuitBreaker: CircuitBreaker;
  private readonly circuitBreakerConfig: CircuitBreakerConfig;
  
  constructor(private configService: ConfigService) {
    this.circuitBreakerConfig = {
      maxFailures: this.configService.get<number>('STELLAR_CIRCUIT_BREAKER_MAX_FAILURES', 5),
      resetTimeout: this.configService.get<number>('STELLAR_CIRCUIT_BREAKER_RESET_TIMEOUT', 60000),
    };
    this.circuitBreaker = new CircuitBreaker();
  }

  public canRetry(error: any): boolean {
    if (this.circuitBreaker.isOpen(this.circuitBreakerConfig)) {
      this.logger.warn(`Circuit breaker is open, refusing to retry. State: ${JSON.stringify(this.circuitBreaker.getState())}`);
      return false;
    }

    const status = this.getHttpStatusFromError(error);
    
    if (status && status >= 400 && status < 500) {
      this.logger.debug(`Non-retryable error (HTTP ${status}): ${error.message || error}`);
      return false;
    }

    return this.isTransientError(error);
  }

  public recordFailure(): void {
    this.circuitBreaker.recordFailure(this.circuitBreakerConfig);
    this.logger.warn(`Recorded failure. Circuit breaker state: ${JSON.stringify(this.circuitBreaker.getState())}`);
  }

  public recordSuccess(): void {
    this.circuitBreaker.recordSuccess();
    this.logger.debug(`Recorded success. Circuit breaker state: ${JSON.stringify(this.circuitBreaker.getState())}`);
  }

  public getCircuitBreakerState(): any {
    return this.circuitBreaker.getState();
  }

  public toStellarRpcException(error: any, defaultMessage: string): StellarRpcException {
    const status = this.getHttpStatusFromError(error);
    const message = this.extractErrorMessage(error);

    if (status && status === HttpStatus.GATEWAY_TIMEOUT) {
      return new StellarRpcTimeoutException(`${defaultMessage}: ${message}`);
    }

    if (this.isNetworkError(error)) {
      return new StellarRpcNetworkException(`${defaultMessage}: ${message}`);
    }

    if (status && status >= 400 && status < 500) {
      return new StellarRpcValidationException(`${defaultMessage}: ${message}`);
    }

    if (this.isAccountError(error)) {
      return new StellarRpcAccountException(`${defaultMessage}: ${message}`);
    }

    if (this.isTransactionError(error)) {
      return new StellarRpcTransactionException(`${defaultMessage}: ${message}`);
    }

    return new StellarRpcException(
      `${defaultMessage}: ${message}`, 
      'RPC_UNKNOWN_ERROR', 
      HttpStatus.BAD_GATEWAY, 
      'network'
    );
  }

  public logError(operation: string, error: any, context: string = ''): void {
    const status = this.getHttpStatusFromError(error);
    const message = this.extractErrorMessage(error);
    
    const contextLog = context ? ` (context: ${context})` : '';
    const statusLog = status ? ` (HTTP ${status})` : '';
    
    this.logger.error(
      `Stellar RPC error in ${operation}${contextLog}${statusLog}: ${message}`
    );
  }

  private getHttpStatusFromError(error: any): number | undefined {
    if (error && typeof error === 'object') {
      if ('status' in error && typeof error.status === 'number') {
        return error.status;
      }
      if (error.response && error.response.status) {
        return error.response.status;
      }
    }
    return undefined;
  }

  private extractErrorMessage(error: any): string {
    if (!error) return 'Unknown error';
    
    if (error instanceof Error) {
      return error.message;
    }
    
    if (typeof error === 'object') {
      if ('message' in error && typeof error.message === 'string') {
        return error.message;
      }
      if ('detail' in error && typeof error.detail === 'string') {
        return error.detail;
      }
      if ('title' in error && typeof error.title === 'string') {
        return error.title;
      }
    }
    
    return String(error);
  }

  private isTransientError(error: any): boolean {
    if (!error) return true;
    
    if (this.isNetworkError(error)) return true;
    if (this.isTimeoutError(error)) return true;
    if (this.isStellarError(error) && !this.isClientError(error)) return true;
    
    return false;
  }

  private isNetworkError(error: any): boolean {
    if (!error) return false;
    
    const errorStr = String(error).toLowerCase();
    return errorStr.includes('network error') || 
           errorStr.includes('enotfound') ||
           errorStr.includes('etimedout') ||
           errorStr.includes('econnrefused');
  }

  private isTimeoutError(error: any): boolean {
    if (!error) return false;
    
    const errorStr = String(error).toLowerCase();
    return errorStr.includes('timeout') ||
           errorStr.includes('timed out') ||
           errorStr.includes('gateway timeout');
  }

  private isStellarError(error: any): boolean {
    if (!error) return false;
    
    const errorStr = String(error).toLowerCase();
    return errorStr.includes('stellar') || 
           (error.response && typeof error.response === 'object') ||
           (error.constructor && error.constructor.name === 'Error');
  }

  private isClientError(error: any): boolean {
    const status = this.getHttpStatusFromError(error);
    return status ? status >= 400 && status < 500 : false;
  }

  private isAccountError(error: any): boolean {
    if (!error) return false;
    
    if (this.isClientError(error)) {
      const errorStr = String(error).toLowerCase();
      return errorStr.includes('account') || 
             errorStr.includes('not found') ||
             errorStr.includes('unauthorized');
    }
    return false;
  }

  private isTransactionError(error: any): boolean {
    if (!error) return false;
    
    const errorStr = String(error).toLowerCase();
    return errorStr.includes('transaction') || 
           errorStr.includes('insufficient balance') ||
           errorStr.includes('bad transaction');
  }
}
