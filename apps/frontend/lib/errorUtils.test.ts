import { getErrorStatus, getFriendlyErrorMessage, isTransientError } from './errorUtils';

describe('API error utilities', () => {
  it('maps backend codes and statuses to friendly messages', () => {
    expect(getFriendlyErrorMessage({ statusCode: 403, message: 'Forbidden' })).toBe(
      'You do not have permission to perform this action.',
    );
    expect(getFriendlyErrorMessage({ code: 'RATE_LIMIT_EXCEEDED' })).toMatch(
      /wait a moment/i,
    );
    expect(getErrorStatus(new Error('HTTP 404'))).toBe(404);
  });

  it('marks network and retryable HTTP failures as transient', () => {
    expect(isTransientError(new Error('Failed to fetch'))).toBe(true);
    expect(isTransientError({ code: 'NETWORK_ERROR' })).toBe(true);
    expect(isTransientError({ status: 503 })).toBe(true);
    expect(isTransientError({ status: 429 })).toBe(true);
    expect(isTransientError({ status: 400 })).toBe(false);
  });
});