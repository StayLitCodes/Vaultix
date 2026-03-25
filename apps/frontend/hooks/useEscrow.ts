import { useState, useEffect } from 'react';
import { IEscrowExtended, IUseEscrowReturn } from '@/types/escrow';

export const useEscrow = (id: string): IUseEscrowReturn => {
  const [escrow, setEscrow] = useState<IEscrowExtended | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEscrow = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/escrows/${id}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Escrow not found');
          } else {
            setError('Failed to load escrow details');
          }
          return;
        }
        
        const data = await response.json();
        setEscrow(data);
        setError(null);
      } catch (err) {
        setError('An error occurred while fetching escrow details');
        console.error('Error fetching escrow:', err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchEscrow();
    }
  }, [id]);

  return { escrow, loading, error };
};