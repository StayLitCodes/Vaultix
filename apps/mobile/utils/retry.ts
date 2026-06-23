/**
 * Retry utility with exponential backoff + jitter for testnet resilience.
 *
 * Usage:
 *   const data = await withRetry(() => escrowApi.list({ status: 'all' }));
 *   const data = await withRetry(() => escrowApi.getById(id), { maxRetries: 5 });
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Initial delay in ms before first retry (default: 1000) */
  initialDelayMs: number;
  /** Maximum delay cap in ms (default: 10000) */
  maxDelayMs: number;
  /** Backoff multiplier (default: 2) */
  backoffFactor: number;
  /** Whether to add random jitter (default: true) */
  jitter: boolean;
  /** Predicate to decide if an error is retryable (default: isRetryableError) */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffFactor: 2,
  jitter: true,
};

/**
 * Check if an error is worth retrying (network errors, 5xx, 429, timeouts).
 */
export function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const err = error as Record<string, unknown>;

  // Axios timeout / network error
  if (err.code === 'ECONNABORTED') return true;
  if (err.code === 'ERR_NETWORK') return true;
  if (err.code === 'ECONNRESET') return true;
  if (err.code === 'ETIMEDOUT') return true;

  // HTTP status-based
  const response = err.response as Record<string, unknown> | undefined;
  if (response && typeof response === 'object' && 'status' in response) {
    const status = response.status as number;
    // 5xx server errors, 429 rate-limit, 502/503/504 gateway
    if (status >= 500 || status === 429 || status === 408) return true;
  }

  return false;
}

/**
 * Compute delay with exponential backoff + optional jitter.
 */
function computeDelay(attempt: number, opts: RetryOptions): number {
  const exponentialDelay = opts.initialDelayMs * Math.pow(opts.backoffFactor, attempt);
  const cappedDelay = Math.min(exponentialDelay, opts.maxDelayMs);
  if (opts.jitter) {
    // Full jitter: random between 0 and cappedDelay
    return Math.floor(Math.random() * cappedDelay);
  }
  return cappedDelay;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an async function with automatic retry and exponential backoff.
 *
 * @param fn - The async function to execute
 * @param opts - Retry configuration
 * @returns The result of fn()
 * @throws The last error if all retries are exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: Partial<RetryOptions> = {},
): Promise<T> {
  const options: RetryOptions = { ...DEFAULT_OPTIONS, ...opts };
  const shouldRetry = options.shouldRetry ?? isRetryableError;

  let lastError: unknown;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if we've hit the limit or the error isn't retryable
      if (attempt >= options.maxRetries || !shouldRetry(error, attempt)) {
        throw error;
      }

      const delay = computeDelay(attempt, options);
      await sleep(delay);
    }
  }

  // Should not reach here, but TypeScript needs it
  throw lastError;
}
