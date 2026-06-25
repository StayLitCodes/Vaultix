"use strict";
import { EventEmitter } from 'events';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import { Network } from '../types/rpc/stellar-rpc.types';
import {
  StellarTimeoutError,
  StellarNetworkError,
  StellarTransactionError,
  StellarAccountError,
} from '../errors';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
}

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  factor: number;
  maxDelay?: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private lastFailureTime: number | null = null;
  private resetTimeout: number;
  private failureThreshold: number;
  private readonly logger = new Logger(CircuitBreaker.name);

  constructor(options: CircuitBreakerOptions) {
    this.failureThreshold = options.failureThreshold;
    this.resetTimeout = options.resetTimeout;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      const timeSinceLastFailure = this.lastFailureTime
        ? Date.now() - this.lastFailureTime
        : Infinity;
      if (timeSinceLastFailure >= this.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
        this.logger.log('Circuit breaker moving to HALF_OPEN state');
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      if (this.state === CircuitState.HALF_OPEN) {
        this.state = CircuitState.CLOSED;
        this.failures = 0;
      }
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      this.logger.error(
        `RPC operation failed (consecutive: ${this.failures}). Error: ${this.getErrorMessage(error)}`,
      );
      if (this.failures >= this.failureThreshold) {
        this.state = CircuitState.OPEN;
        this.logger.warn(
          `Circuit breaker OPENED after ${this.failures} consecutive failures. Paused for ${this.resetTimeout}ms`,
        );
      }
      throw error;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getFailures(): number {
    return this.failures;
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.lastFailureTime = null;
    this.logger.log('Circuit breaker reset to CLOSED');
  }
}

export class StellarRpcClient {
  private circuitBreaker: CircuitBreaker;
  private retryOptions: RetryOptions;

  constructor(
    private readonly configService: ConfigService,
    retryOptions?: Partial<RetryOptions>,
    circuitBreakerOptions?: Partial<CircuitBreakerOptions>,
  ) {
    this.retryOptions = {
      maxRetries: this.configService.get<number>('STELLAR_MAX_RETRIES', 3),
      baseDelay: this.configService.get<number>('STELLAR_RETRY_DELAY', 1000),
      factor: 2,
      maxDelay: 60000,
      ...retryOptions,
    };

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000,
      ...circuitBreakerOptions,
    });

    const logger = new Logger(StellarRpcClient.name);
    logger.log('Stellar RPC client initialized');
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<StellarRpcResponse<T>> {
    const startTime = Date.now();
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.retryOptions.maxRetries; attempt++) {
      try {
        const result = await this.circuitBreaker.execute(operation);
        const latency = Date.now() - startTime;
        const logger = new Logger(StellarRpcClient.name);
        logger.log(
          `Operation '${operationName}' succeeded after ${attempt} attempts (${latency}ms)`,
        );
        return {
          data: result,
          success: true,
          latency,
        };
      } catch (error) {
        lastError = error;
        const isRetryable = this.isRetryableError(error);

        if (!isRetryable || attempt === this.retryOptions.maxRetries) {
          const latency = Date.now() - startTime;
          const errorResponse = this.mapToException(error, operationName);
          const logger = new Logger(StellarRpcClient.name);
          logger.error(
            `Operation '${operationName}' failed after ${attempt + 1} attempts (${latency}ms): ${errorResponse.message}`, {
              errorCode: errorResponse.errorCode,
              httpStatus: errorResponse.httpStatus,
            }, error instanceof Error ? error.stack : undefined,
          );
          return {
            data: null,
            error: errorResponse,
            success: false,
            latency,
          };
        }

        const delay = this.getDelay(attempt);
        const logger = new Logger(StellarRpcClient.name);
        logger.warn(
          `Operation '${operationName}' failed (attempt ${attempt + 1}), retrying in ${delay}ms: ${this.getErrorMessage(error)}`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  private isRetryableError(error: unknown): boolean {
    if (typeof error === 'object' && error !== null && 'isRetryable' in error) {
      const isRetryable = error.isRetryable;
      const is4xxError = typeof error === 'object' && error !== null && 'httpStatus' in error && error.httpStatus >= 400 && error.httpStatus < 500;

      if (is4xxError && !isRetryable) {
        return false;
      }

      if (is4xxError) {
        return false;
      }

      return isRetryable;
    }

    if (StellarSdk.Horizon.ServerError.is(error)) {
      const serverError = error as StellarSdk.Horizon.ServerError;
      const status = serverError.response?.status || 0;

      if (status >= 400 && status < 500) {
        return false;
      }

      return [408, 429, 503, 504].includes(status);
    }

    if (error instanceof Error && error.message.includes('timeout')) {
      return true;
    }

    if (error instanceof TypeError && error.message.includes('network')) {
      return true;
    }

    return false;
  }

  private mapToException(error: unknown, operationName: string): StellarRpcException {
    if (error instanceof Error) {
      if (error instanceof StellarTimeoutError) {
        return error;
      }
      if (error instanceof StellarNetworkError) {
        return error;
      }
      if (error instanceof StellarTransactionError) {
        return error;
      }
      if (error instanceof StellarAccountError) {
        return error;
      }
      if (StellarSdk.Horizon.ServerError.is(error)) {
        const serverError = error as StellarSdk.Horizon.ServerError;
        const status = serverError.response?.status || 500;
        const message = serverError.response?.data?.detail || serverError.message;

        if ([408, 503, 504].includes(status)) {
          return new StellarTimeoutError(`${operationName}: ${message}`);
        }

        if ([429].includes(status)) {
          return new StellarNetworkError(`${operationName}: ${message}`);
        }

        if ([400, 401, 403, 409, 412].includes(status)) {
          return new StellarTransactionError(`${operationName}: ${message}`);
        }

        if ([403, 404, 405].includes(status)) {
          return new StellarAccountError(`${operationName}: ${message}`);
        }

        return new StellarTransactionError(`${operationName}: ${message}`);
      }

      if (error.message.includes('timeout')) {
        return new StellarTimeoutError(`${operationName}: ${error.message}`);
      }

      if (error.message.includes('network')) {
        return new StellarNetworkError(`${operationName}: ${error.message}`);
      }
    }

    return new StellarTransactionError(`${operationName}: ${this.getErrorMessage(error)}`);
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'object' && error !== null && 'message' in error) {
      return String(error.message);
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error';
  }

  private getDelay(attempt: number): number {
    const delay = this.retryOptions.baseDelay * Math.pow(this.retryOptions.factor, attempt);
    const jitter = Math.random() * 0.1 * delay;
    const totalDelay = delay + jitter;
    return Math.min(totalDelay, this.retryOptions.maxDelay!);
  }

  getCircuitState(): CircuitState {
    return this.circuitBreaker.getState();
  }

  getFailures(): number {
    return this.circuitBreaker.getFailures();
  }

  resetCircuit(): void {
    this.circuitBreaker.reset();
  }
}

export interface StellarRpcResponse<T> {
  data: T | null;
  error?: StellarRpcException;
  success: boolean;
  latency: number;
}

export interface StellarRpcHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  horizon?: {
    lastLedger: number;
    peers: number;
    network: string;
  };
  timestamp: string;
  latency?: number;
}

export { StellarTimeoutError, StellarNetworkError, StellarTransactionError, StellarAccountError };
