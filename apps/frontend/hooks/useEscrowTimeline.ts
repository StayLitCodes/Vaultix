'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { IEscrowEvent } from '@/types/escrow';
import { fetchEscrowEvents } from '@/lib/escrow-api';
import { useGlobalWebSocket } from '@/app/contexts/WebSocketContext';

const POLL_INTERVAL_MS = 30_000;

const WS_EVENT_NAMES = [
  'escrow:status_changed',
  'escrow:funded',
  'escrow:completed',
  'escrow:cancelled',
  'escrow:dispute_filed',
  'escrow:dispute_resolved',
  'escrow:event',
];

export interface UseEscrowTimelineReturn {
  events: IEscrowEvent[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useEscrowTimeline(
  escrowId: string,
  initialEvents?: IEscrowEvent[],
): UseEscrowTimelineReturn {
  const [events, setEvents] = useState<IEscrowEvent[]>(initialEvents ?? []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { socket, isConnected } = useGlobalWebSocket();

  const fetch = useCallback(async () => {
    if (!escrowId) return;
    try {
      const res = await fetchEscrowEvents(escrowId, {
        limit: 100,
        sortOrder: 'ASC',
      });
      // Normalize: backend returns IEventResponse, cast to IEscrowEvent
      setEvents(res.data as unknown as IEscrowEvent[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  }, [escrowId]);

  // Initial fetch
  useEffect(() => {
    void fetch();
  }, [fetch]);

  // WebSocket: rejoin room and refetch on any escrow event
  useEffect(() => {
    if (!socket || !isConnected || !escrowId) return;

    socket.emit('escrow:join', { id: escrowId });

    const handleUpdate = () => void fetch();
    WS_EVENT_NAMES.forEach((evt) => socket.on(evt, handleUpdate));

    return () => {
      WS_EVENT_NAMES.forEach((evt) => socket.off(evt, handleUpdate));
    };
  }, [socket, isConnected, escrowId, fetch]);

  // Polling fallback when WebSocket is not connected
  useEffect(() => {
    if (isConnected) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }
    pollingRef.current = setInterval(() => void fetch(), POLL_INTERVAL_MS);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isConnected, fetch]);

  return { events, loading, error, refetch: fetch };
}
