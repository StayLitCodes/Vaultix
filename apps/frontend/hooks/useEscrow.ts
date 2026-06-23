import { useCallback, useEffect, useState, useRef } from 'react';
import { fetchEscrow } from '@/lib/escrow-api';
import { IEscrowExtended, IUseEscrowReturn } from '@/types/escrow';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

export const useEscrow = (id: string): IUseEscrowReturn & { isLive: boolean } => {
  const [escrow, setEscrow] = useState<IEscrowExtended | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState<boolean>(false);
  
  const socketRef = useRef<Socket | null>(null);
  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // ── WebSocket Lifecycle Room Subscriptions ──
  useEffect(() => {
    if (!id) return;

    const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
    
    const socket = io(WS_URL, {
      transports: ['websocket'],
      autoConnect: true,
      reconnectionAttempts: 5,
    });
    
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsLive(true);
      stopPollingFallback();
      socket.emit('escrow:join', { id });
    });

    socket.on('disconnect', () => {
      setIsLive(false);
      startPollingFallback();
    });

    socket.on('connect_error', () => {
      setIsLive(false);
      startPollingFallback();
    });

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
      socket.disconnect();
      stopPollingFallback();
    };
  }, [id, refetch, startPollingFallback, stopPollingFallback]);

  return { escrow, loading, error, refetch, isLive };
};