import { useCallback, useEffect, useState, useRef } from 'react';
import { fetchEscrow } from '@/lib/escrow-api';
import { IEscrowExtended, IUseEscrowReturn } from '@/types/escrow';
import { useWebSocket } from '@/app/contexts/WebSocketContext';
import { toast } from 'sonner';

export const useEscrow = (id: string): IUseEscrowReturn & {
  isLive: boolean;
  refreshAfterTransaction: () => Promise<void>;
} => {
  const [escrow, setEscrow] = useState<IEscrowExtended | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState<boolean>(false);
  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { socket, isConnected } = useWebSocket();

  const refetch = useCallback(async () => {
    if (!id) {
      setEscrow(null);
      setLoading(false);
      return;
    }

    try {
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

  const refreshAfterTransaction = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Handle active background data sync loops if WebSockets drop out
  const startPollingFallback = useCallback(() => {
    if (fallbackIntervalRef.current) clearInterval(fallbackIntervalRef.current);
    fallbackIntervalRef.current = setInterval(() => {
      void refetch();
    }, 5000); // 5-second health loop sync
  }, [refetch]);

  const stopPollingFallback = useCallback(() => {
    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    setIsLive(isConnected);
    if (isConnected) {
      stopPollingFallback();
    } else {
      startPollingFallback();
    }

    return stopPollingFallback;
  }, [isConnected, startPollingFallback, stopPollingFallback]);

  useEffect(() => {
    if (!id || !socket || !isConnected) return;

    socket.emit('escrow:join', { id });

    // Real-time pipe events
    const handleLiveUpdate = (event: { message: string }) => {
      toast.info(event.message || 'Escrow ledger balance or status changed.');
      void refetch();
    };

    socket.on('escrow:status_changed', handleLiveUpdate);
    socket.on('escrow:funded', handleLiveUpdate);
    socket.on('escrow:completed', handleLiveUpdate);
    socket.on('escrow:dispute_filed', handleLiveUpdate);
    socket.on('escrow:dispute_resolved', handleLiveUpdate);

    return () => {
      socket.emit('escrow:leave', { id });
      socket.off('escrow:status_changed', handleLiveUpdate);
      socket.off('escrow:funded', handleLiveUpdate);
      socket.off('escrow:completed', handleLiveUpdate);
      socket.off('escrow:dispute_filed', handleLiveUpdate);
      socket.off('escrow:dispute_resolved', handleLiveUpdate);
    };
  }, [id, socket, isConnected, refetch]);

  return { escrow, loading, error, refetch, refreshAfterTransaction, isLive };
};