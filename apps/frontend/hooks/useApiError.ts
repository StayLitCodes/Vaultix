'use client';

import { useState, useCallback, Dispatch, SetStateAction } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/useToast';
<<<<<<< Updated upstream
import { apiClient } from '@/lib/api-client';
=======
import { clearSession } from '@/lib/session';
import { getErrorStatus, getFriendlyErrorMessage } from '@/lib/errorUtils';
>>>>>>> Stashed changes

interface UseApiErrorReturn {
  handleError: (error: unknown, retry?: () => void) => void;
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
    (err: unknown, retry?: () => void) => {
      const message = getFriendlyErrorMessage(err);
      setError(message);
      const status = getErrorStatus(err);

      if (status === 401) {
<<<<<<< Updated upstream
        apiClient.setToken(null);
        toast.error('Session expired. Please sign in again.');
=======
        clearSession();
        toast.apiError(err);
>>>>>>> Stashed changes
        router.push('/');
        return;
      }

      toast.apiError(err, retry);
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
        handleError(err, () => {
          void wrapAsync(fn);
        });
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [handleError],
  );

  return { handleError, wrapAsync, isLoading, setIsLoading, error };
}
