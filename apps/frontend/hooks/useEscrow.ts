import { useCallback, useEffect, useState } from 'react';
import { fetchEscrow } from '@/lib/escrow-api';
import { IEscrowExtended, IUseEscrowReturn } from '@/types/escrow';

export const useEscrow = (id: string): IUseEscrowReturn => {
  const [escrow, setEscrow] = useState<IEscrowExtended | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!id) {
      setEscrow(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await fetchEscrow(id);
      setEscrow(data);
      setError(null);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'An error occurred while fetching escrow details';

      setError(message.includes('404') ? 'Escrow not found' : message);
      console.error('Error fetching escrow:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { escrow, loading, error, refetch };
};
