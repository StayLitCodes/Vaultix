'use client';

import { useCallback } from 'react';
import { reportError, ErrorReportInfo } from '@/lib/errorReporter';

export function useErrorReporter() {
  return useCallback(
    (error: unknown, info?: ErrorReportInfo) => {
      reportError(error, info);
    },
    [],
  );
}
