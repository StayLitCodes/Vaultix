/**
 * Exponential backoff retry utility
 * @param fn The function to retry
 * @param maxRetries Maximum number of retry attempts
 * @param baseDelay Base delay in milliseconds
 * @param factor Exponential factor (default 2)
 * @returns Promise resolving to the result of the function
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  baseDelay: number,
  factor: number = 2,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = baseDelay * Math.pow(factor, attempt);
      const jitter = Math.random() * 0.1 * delay; // Add up to 10% jitter
      const totalDelay = delay + jitter;

      await new Promise((resolve) => setTimeout(resolve, totalDelay));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
