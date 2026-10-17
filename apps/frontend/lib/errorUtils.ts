'use client';

export type ErrorKind = 'network' | 'auth' | 'server' | 'unknown';

export interface ErrorClassification {
  kind: ErrorKind;
  title: string;
  description: string;
}

const ERROR_CODE_MESSAGES: Record<string, string> = {
  BAD_REQUEST: 'Please check the information you entered and try again.',
  VALIDATION_ERROR: 'Some information could not be accepted. Please review your entries.',
  INVALID_INPUT: 'Some information could not be accepted. Please review your entries.',
  UNAUTHORIZED: 'Your session has expired. Please sign in again.',
  TOKEN_EXPIRED: 'Your session has expired. Please sign in again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  PERMISSION_DENIED: 'You do not have permission to perform this action.',
  NOT_FOUND: 'We could not find what you were looking for.',
  RESOURCE_NOT_FOUND: 'We could not find what you were looking for.',
  CONFLICT: 'This action conflicts with a recent change. Refresh and try again.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait a moment and try again.',
  TOO_MANY_REQUESTS: 'Too many requests. Please wait a moment and try again.',
  INTERNAL_SERVER_ERROR: 'A server error occurred. Please try again shortly.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again shortly.',
  NETWORK_ERROR: 'We could not connect to the server. Check your connection and try again.',
  ECONNABORTED: 'The request timed out. Please try again.',
  ETIMEDOUT: 'The request timed out. Please try again.',
};

const NETWORK_ERROR_CODES = new Set([
  'NETWORK_ERROR',
  'ECONNABORTED',
  'ECONNRESET',
  'ETIMEDOUT',
  'TIMEOUT',
]);

const TRANSIENT_ERROR_CODES = new Set([
  ...NETWORK_ERROR_CODES,
  'RATE_LIMIT_EXCEEDED',
  'TOO_MANY_REQUESTS',
  'INTERNAL_SERVER_ERROR',
  'SERVICE_UNAVAILABLE',
]);

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Please check the information you entered and try again.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'We could not find what you were looking for.',
  408: 'The request timed out. Please try again.',
  409: 'This action conflicts with a recent change. Refresh and try again.',
  422: 'Some information could not be accepted. Please review your entries.',
  425: 'The service is not ready for this request. Please try again shortly.',
  429: 'Too many requests. Please wait a moment and try again.',
};

const getMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null) {
    const typedError = error as Record<string, unknown>;
    if (typeof typedError.message === 'string') return typedError.message;
    if (typeof typedError.error === 'string') return typedError.error;
  }
  return 'An unexpected error occurred.';
};

export const getErrorStatus = (error: unknown): number | undefined => {
  if (typeof error === 'object' && error !== null) {
    const typedError = error as Record<string, unknown>;
    const statusValue = typedError.status ?? typedError.statusCode;
    if (typeof statusValue === 'number') return statusValue;
    if (typeof statusValue === 'string' && /^\d{3}$/.test(statusValue)) {
      return Number(statusValue);
    }
  }

  const message = getMessage(error);
  const match = message.match(/HTTP\s*(\d{3})/i) || message.match(/\b(\d{3})\b/);
  if (match) {
    return Number(match[1]);
  }

  return undefined;
};

const getErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null) return undefined;
  const { code } = error as Record<string, unknown>;
  return typeof code === 'string' ? code.toUpperCase().replace(/[\s-]+/g, '_') : undefined;
};

const isNetworkError = (message: string) => {
  const lower = message.toLowerCase();
  return (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('connection refused') ||
    lower.includes('socket hang up') ||
    lower.includes('timeout')
  );
};

export function getFriendlyErrorMessage(error: unknown): string {
  const code = getErrorCode(error);
  if (code && ERROR_CODE_MESSAGES[code]) return ERROR_CODE_MESSAGES[code];

  const status = getErrorStatus(error);
  if (status && STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
  if (status && status >= 500) {
    return 'A server error occurred. Please try again shortly.';
  }

  const message = getMessage(error);
  if (isNetworkError(message)) {
    return 'We could not connect to the server. Check your connection and try again.';
  }
  if (status && status >= 400) {
    return 'We could not complete that request. Please check your information and try again.';
  }

  return message;
}

export function isTransientError(error: unknown): boolean {
  const status = getErrorStatus(error);
  const code = getErrorCode(error);
  return (
    (code !== undefined && TRANSIENT_ERROR_CODES.has(code)) ||
    isNetworkError(getMessage(error)) ||
    status === 408 ||
    status === 425 ||
    status === 429 ||
    (status !== undefined && status >= 500)
  );
}

export function classifyError(error: unknown): ErrorClassification {
  const message = getMessage(error);
  const status = getErrorStatus(error);
  const code = getErrorCode(error);

  if (isNetworkError(message) || (code !== undefined && NETWORK_ERROR_CODES.has(code))) {
    return {
      kind: 'network',
      title: 'Network issue detected',
      description:
        'We had trouble connecting to the server. Check your network and try again.',
    };
  }

  if (status === 401 || status === 403 || /unauthori[sz]ed|permission denied/i.test(message)) {
    return {
      kind: 'auth',
      title: 'Authentication required',
      description:
        'Your session may have expired or you do not have access. Sign in again to continue.',
    };
  }

  if ((status && status >= 500) || /server error|internal error|bad gateway/i.test(message)) {
    return {
      kind: 'server',
      title: 'Server error occurred',
      description:
        'The server encountered an issue. Please try again shortly.',
    };
  }

  return {
    kind: 'unknown',
    title: 'Something went wrong',
    description:
      'An unexpected error occurred. You can try again or return to a safe page.',
  };
}
