import { CircuitBreaker, CircuitState } from './rpc/stellar-rpc-client.service';
import {
  StellarTimeoutError,
  StellarNetworkError,
  StellarTransactionError,
  StellarAccountError,
} from '../errors';

const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock('@nestjs/common', () => ({
  Logger: jest.fn(() => mockLogger),
}));

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  const options = { failureThreshold: 3, resetTimeout: 1000 };

  beforeEach(() => {
    mockLogger.log.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    circuitBreaker = new CircuitBreaker(options);
  });

  it('should execute successfully when in closed state', async () => {
    const operation = jest.fn().mockResolvedValue('success');
    const result = await circuitBreaker.execute(operation);
    expect(result).toBe('success');
    expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    expect(operation).toHaveBeenCalled();
  });

  it('should move to open state after threshold failures', async () => {
    const operation = jest.fn().mockRejectedValueOnce(new Error('failure'));

    await expect(circuitBreaker.execute(operation)).rejects.toThrow('failure');
    expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    expect(circuitBreaker.getFailures()).toBe(1);

    await expect(circuitBreaker.execute(operation)).rejects.toThrow('Circuit breaker is OPEN');
    expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
  });

  it('should reset after timeout when open', async () => {
    const operation = jest.fn().mockRejectedValueOnce(new Error('failure'));

    await expect(circuitBreaker.execute(operation)).rejects.toThrow('failure');
    await expect(circuitBreaker.execute(operation)).rejects.toThrow('Error is OPEN');

    circuitBreaker.reset();
    expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    expect(circuitBreaker.getFailures()).toBe(0);
  });

  it('should half-open after timeout and allow execution', async () => {
    jest.useRealTimers();
    const operation = jest.fn().mockRejectedValueOnce(new Error('failure'));

    await expect(circuitBreaker.execute(operation)).rejects.toThrow('failure');

    setTimeout(() => {
      circuitBreaker.execute(operation)
        .then(() => {
          expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
          expect(operation).toHaveBeenCalledTimes(2);
        })
        .catch(console.error);
    }, 1100);
    jest.useFakeTimers();
    jest.advanceTimersByTime(1100);
  });

  it('should reject when open', async () => {
    const operation = jest.fn().mockRejectedValueOnce(new Error('failure'));

    await expect(circuitBreaker.execute(operation)).rejects.toThrow('failure');
    await expect(circuitBreaker.execute(operation)).rejects.toThrow('Circuit breaker is OPEN');
    expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
  });
});

jest.mock('@nestjs/config', () => ({
  ConfigService: jest.fn(() => ({
    get: jest.fn((key: string) => {
      if (key === 'STELLAR_MAX_RETRIES') return 3;
      if (key === 'STELLAR_RETRY_DELAY') return 1000;
      return null;
    }),
  })),
}));

describe('StellarRpcClient', () => {
  let client: StellarRpcClient;
  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'STELLAR_MAX_RETRIES') return 3;
      if (key === 'STELLAR_RETRY_DELAY') return 1000;
      return null;
    }),
  };

  beforeEach(async () => {
    const MockConfigService = jest.fn(() => mockConfigService);
    const module = new StellarRpcClient(MockConfigService, {
      maxRetries: 2,
      baseDelay: 500,
    });
    client = module;
  });

  it('should execute operation successfully', async () => {
    const operation = jest.fn().mockResolvedValue('success');
    const response = await client.executeWithRetry(operation, 'testOp');
    expect(response.success).toBe(true);
    expect(response.data).toBe('success');
    expect(operation).toHaveBeenCalled();
  });

  it('should retry on network error', async () => {
    const operation = jest.fn()
      .mockRejectedValueOnce(new StellarTimeoutError('Network timeout'))
      .mockRejectedValueOnce(new StellarTimeoutError('Network timeout'))
      .mockResolvedValueOnce('success');

    const response = await client.executeWithRetry(operation, 'testOp');
    expect(response.success).toBe(true);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should fail after max retries', async () => {
    const operation = jest.fn().mockRejectedValue(new StellarTimeoutError('Network timeout'));
    const response = await client.executeWithRetry(operation, 'testOp');
    expect(response.success).toBe(false);
    expect(response.error).toBeInstanceOf(StellarTimeoutError);
  });

  it('should not retry on client error', async () => {
    const operation = jest.fn().mockRejectedValue(new StellarTransactionError('Invalid transaction'));
    const response = await client.executeWithRetry(operation, 'testOp');
    expect(response.success).toBe(false);
    expect(response.error).toBeInstanceOf(StellarTransactionError);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should get circuit state', () => {
    expect(client.getCircuitState()).toBe(CircuitState.CLOSED);
  });

  it('should get failures', () => {
    expect(client.getFailures()).toBe(0);
  });

  it('should reset circuit', () => {
    client.resetCircuit();
    expect(client.getCircuitState()).toBe(CircuitState.CLOSED);
  });
});
