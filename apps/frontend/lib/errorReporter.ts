'use client';

export interface ErrorReportInfo {
  componentStack?: string;
}

export function reportError(error: unknown, info?: ErrorReportInfo) {
  // This is a placeholder for an error reporting integration such as Sentry.
  console.warn('[ErrorReporter]', error, info);
}
