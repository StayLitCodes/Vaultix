'use client';

export type ErrorKind = 'network' | 'auth' | 'server' | 'unknown';

export interface ErrorClassification {
  kind: ErrorKind;
  title: string;
  description: string;
}

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

const getStatusCode = (error: unknown): number | undefined => {
  if (typeof error === 'object' && error !== null) {
    const typedError = error as Record<string, unknown>;
    const statusValue = typedError.status ?? typedError.statusCode ?? typedError.code;
    if (typeof statusValue === 'number') return statusValue;
    if (typeof statusValue === 'string' && /^\\\d{3}\\b$/.test(statusValue)) {
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

export function classifyError(error: unknown): ErrorClassification {
  const message = getMessage(error);
  const status = getStatusCode(error);

  if (isNetworkError(message)) {
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
