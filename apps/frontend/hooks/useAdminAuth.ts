import { useState, useEffect, useCallback } from 'react';
import { AdminService, AdminApiError } from '@/services/admin';

interface UseAdminAuthReturn {
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  checkAdmin: () => Promise<boolean>;
}

/**
 * Hook to check if the current user has admin privileges.
 * Attempts to fetch admin stats to verify admin role.
 * Returns false if user is not authenticated or doesn't have admin role.
 */
export const useAdminAuth = (): UseAdminAuthReturn => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAdmin = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      // Try to fetch admin stats — this will fail with 403 if user is not admin
      await AdminService.getStats();
      setIsAdmin(true);
      return true;
    } catch (err) {
      if (err instanceof AdminApiError) {
        if (err.status === 403) {
          setError('Access denied — admin role required.');
        } else if (err.status === 401) {
          setError('Not authenticated.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to verify admin status.');
      }
      setIsAdmin(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAdmin();
  }, [checkAdmin]);

  return { isAdmin, isLoading, error, checkAdmin };
};
