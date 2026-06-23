/**
 * Maps raw HTTP/network errors to user-friendly copy.
 * Designed for testnet scenarios where endpoints can be slow or unreliable.
 */

export interface FriendlyError {
  title: string;
  message: string;
  isOffline: boolean;
  isRetryable: boolean;
}

/**
 * Detect if an error looks like a network-offline condition.
 */
export function isOfflineError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as Record<string, unknown>;

  // Classic offline signals
  if (err.code === 'ERR_NETWORK') return true;
  if (err.code === 'ECONNREFUSED') return true;
  if (err.code === 'ENOTFOUND') return true;
  if (err.code === 'ETIMEDOUT') return true;
  if (err.code === 'ECONNRESET') return true;

  // Axios timeout
  if (err.code === 'ECONNABORTED') return true;

  // No response at all = network down
  if (!('response' in err) && ('request' in err)) return true;

  return false;
}

/**
 * Convert any error into a user-friendly message.
 */
export function toFriendlyError(error: unknown): FriendlyError {
  if (!error || typeof error !== 'object') {
    return {
      title: 'Something went wrong',
      message: 'An unexpected error occurred. Please try again.',
      isOffline: false,
      isRetryable: true,
    };
  }

  const err = error as Record<string, unknown>;
  const offline = isOfflineError(error);

  // --- Offline / network errors ---
  if (offline) {
    return {
      title: 'No internet connection',
      message: 'It looks like you\'re offline. Check your connection and try again.',
      isOffline: true,
      isRetryable: true,
    };
  }

  // --- HTTP status-based errors ---
  const response = err.response as Record<string, unknown> | undefined;
  if (response && typeof response === 'object' && 'status' in response) {
    const status = response.status as number;
    const data = response.data as Record<string, unknown> | undefined;
    const serverMsg = data && typeof data === 'object' && 'message' in data
      ? String(data.message)
      : undefined;

    switch (status) {
      case 400:
        return {
          title: 'Invalid request',
          message: serverMsg ?? 'The request could not be processed. Please check your input and try again.',
          isOffline: false,
          isRetryable: false,
        };
      case 401:
        return {
          title: 'Session expired',
          message: 'Your session has expired. Please reconnect your wallet and try again.',
          isOffline: false,
          isRetryable: false,
        };
      case 403:
        return {
          title: 'Access denied',
          message: serverMsg ?? 'You don\'t have permission to perform this action.',
          isOffline: false,
          isRetryable: false,
        };
      case 404:
        return {
          title: 'Not found',
          message: 'The resource you\'re looking for doesn\'t exist or has been removed.',
          isOffline: false,
          isRetryable: false,
        };
      case 408:
        return {
          title: 'Request timed out',
          message: 'The server took too long to respond. This can happen on testnet during high traffic. Please try again.',
          isOffline: false,
          isRetryable: true,
        };
      case 409:
        return {
          title: 'Conflict',
          message: serverMsg ?? 'This action conflicts with the current state. Refresh and try again.',
          isOffline: false,
          isRetryable: true,
        };
      case 429:
        return {
          title: 'Too many requests',
          message: 'You\'re making requests too quickly. Please wait a moment and try again.',
          isOffline: false,
          isRetryable: true,
        };
      case 500:
        return {
          title: 'Server error',
          message: 'The server encountered an error. This is common on testnet. Please try again in a moment.',
          isOffline: false,
          isRetryable: true,
        };
      case 502:
      case 503:
      case 504:
        return {
          title: 'Service unavailable',
          message: 'The network is temporarily unavailable. Testnet services can be intermittent — please try again shortly.',
          isOffline: false,
          isRetryable: true,
        };
      default:
        if (status >= 500) {
          return {
            title: 'Server error',
            message: serverMsg ?? 'Something went wrong on our end. Please try again.',
            isOffline: false,
            isRetryable: true,
          };
        }
        return {
          title: 'Request failed',
          message: serverMsg ?? `Request failed (HTTP ${status}). Please try again.`,
          isOffline: false,
          isRetryable: status >= 400,
        };
    }
  }

  // --- Fallback for unknown errors ---
  return {
    title: 'Something went wrong',
    message: 'An unexpected error occurred. Please try again.',
    isOffline: false,
    isRetryable: true,
  };
}
