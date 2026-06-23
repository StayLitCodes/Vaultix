'use client';

import { useState, useCallback, Dispatch, SetStateAction } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/useToast';
import { apiClient } from '@/lib/api-client';

interface UseApiErrorReturn {
  handleError: (error: unknown) => void;
  wrapAsync: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  error: string | null;
}

export function useApiError(): UseApiErrorReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();

  const handleError = useCallback(
    (err: unknown) => {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);

      const statusMatch = message.match(/HTTP (\d{3})/);
      const status = statusMatch ? parseInt(statusMatch[1], 10) : null;

      if (status === 401) {
        apiClient.setToken(null);
        toast.error('Session expired. Please sign in again.');
        router.push('/');
        return;
      }

      if (status === 403) {
        toast.error('You do not have permission to perform this action.');
        return;
      }

      if (status !== null && status >= 500) {
        toast.error('A server error occurred. Please try again later.');
        return;
      }

      toast.error(message);
    },
    [router, toast],
  );

  const wrapAsync = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
      try {
        setIsLoading(true);
        setError(null);
        return await fn();
      } catch (err) {
        handleError(err);
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [handleError],
  );

  return { handleError, wrapAsync, isLoading, setIsLoading, error };
}
