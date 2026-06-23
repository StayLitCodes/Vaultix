'use client';

import { useEffect } from 'react';
import { ErrorFallback } from '@/components/ErrorFallback';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <ErrorFallback error={error} reset={reset} title="Application Error" />
    </div>
  );
}
