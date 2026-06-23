/**
<<<<<<< HEAD
 * Unit tests for mobile API services + reliability utilities
 */
import { escrowApi } from '../services/api';
import { isRetryableError, withRetry } from '../utils/retry';
import { toFriendlyError, isOfflineError } from '../utils/errors';
=======
 * Basic unit tests for mobile API services
 */
import { escrowApi } from '../services/api';
import { notificationApi } from '../services/api';
>>>>>>> d431ba40ce53cfcf510d9b702e2540ee53b1f9f1

// Mock axios
jest.mock('axios', () => ({
  create: () => ({
    get: jest.fn(),
    post: jest.fn(),
    interceptors: { request: { use: jest.fn() } },
  }),
}));

describe('escrowApi', () => {
  it('exports list, getById, create, releaseMilestone, getTxStatus', () => {
    expect(typeof escrowApi.list).toBe('function');
    expect(typeof escrowApi.getById).toBe('function');
    expect(typeof escrowApi.create).toBe('function');
    expect(typeof escrowApi.releaseMilestone).toBe('function');
    expect(typeof escrowApi.getTxStatus).toBe('function');
  });
});

<<<<<<< HEAD
describe('isRetryableError', () => {
  it('retries on network errors', () => {
    expect(isRetryableError({ code: 'ECONNABORTED' })).toBe(true);
    expect(isRetryableError({ code: 'ERR_NETWORK' })).toBe(true);
    expect(isRetryableError({ code: 'ETIMEDOUT' })).toBe(true);
  });

  it('retries on 5xx and 429', () => {
    expect(isRetryableError({ response: { status: 500 } })).toBe(true);
    expect(isRetryableError({ response: { status: 502 } })).toBe(true);
    expect(isRetryableError({ response: { status: 429 } })).toBe(true);
  });

  it('does not retry on 4xx client errors', () => {
    expect(isRetryableError({ response: { status: 400 } })).toBe(false);
    expect(isRetryableError({ response: { status: 404 } })).toBe(false);
    expect(isRetryableError({ response: { status: 403 } })).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
  });
});

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { maxRetries: 2, jitter: false });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable error and eventually succeeds', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce({ code: 'ECONNABORTED' })
      .mockResolvedValueOnce('ok');
    const result = await withRetry(fn, { maxRetries: 2, initialDelayMs: 10, jitter: false });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after max retries exhausted', async () => {
    const fn = jest.fn().mockRejectedValue({ code: 'ECONNABORTED' });
    await expect(withRetry(fn, { maxRetries: 1, initialDelayMs: 10, jitter: false }))
      .rejects.toEqual({ code: 'ECONNABORTED' });
    expect(fn).toHaveBeenCalledTimes(2); // initial + 1 retry
  });

  it('does not retry non-retryable errors', async () => {
    const fn = jest.fn().mockRejectedValue({ response: { status: 404 } });
    await expect(withRetry(fn, { maxRetries: 3, jitter: false }))
      .rejects.toEqual({ response: { status: 404 } });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('isOfflineError', () => {
  it('detects offline error codes', () => {
    expect(isOfflineError({ code: 'ERR_NETWORK' })).toBe(true);
    expect(isOfflineError({ code: 'ECONNREFUSED' })).toBe(true);
    expect(isOfflineError({ code: 'ENOTFOUND' })).toBe(true);
  });

  it('detects request-without-response pattern', () => {
    expect(isOfflineError({ request: {} })).toBe(true);
  });

  it('returns false for server errors', () => {
    expect(isOfflineError({ response: { status: 500 } })).toBe(false);
  });
});

describe('toFriendlyError', () => {
  it('maps offline errors to friendly messages', () => {
    const result = toFriendlyError({ code: 'ERR_NETWORK' });
    expect(result.isOffline).toBe(true);
    expect(result.title).toBe('No internet connection');
    expect(result.message).toContain('offline');
  });

  it('maps 404 to friendly message', () => {
    const result = toFriendlyError({ response: { status: 404 } });
    expect(result.isOffline).toBe(false);
    expect(result.title).toBe('Not found');
  });

  it('maps 500 with testnet context', () => {
    const result = toFriendlyError({ response: { status: 500 } });
    expect(result.isRetryable).toBe(true);
    expect(result.message).toContain('testnet');
  });

  it('maps 503 with testnet context', () => {
    const result = toFriendlyError({ response: { status: 503 } });
    expect(result.isRetryable).toBe(true);
    expect(result.message).toContain('testnet');
  });

  it('maps 401 to session expired', () => {
    const result = toFriendlyError({ response: { status: 401 } });
    expect(result.title).toBe('Session expired');
    expect(result.message).toContain('wallet');
  });

  it('handles unknown errors gracefully', () => {
    const result = toFriendlyError(null);
    expect(result.title).toBe('Something went wrong');
  });

  it('prefers server message when available', () => {
    const result = toFriendlyError({ response: { status: 400, data: { message: 'Custom server error' } } });
    expect(result.message).toBe('Custom server error');
=======
describe('notificationApi', () => {
  it('exports list, getUnreadCount, markAsRead', () => {
    expect(typeof notificationApi.list).toBe('function');
    expect(typeof notificationApi.getUnreadCount).toBe('function');
    expect(typeof notificationApi.markAsRead).toBe('function');
>>>>>>> d431ba40ce53cfcf510d9b702e2540ee53b1f9f1
  });
});

describe('Escrow types', () => {
  it('EscrowStatus values are valid', () => {
    const validStatuses = ['created', 'funded', 'confirmed', 'released', 'completed', 'cancelled', 'disputed', 'expired'];
    validStatuses.forEach((s) => expect(typeof s).toBe('string'));
  });
});
