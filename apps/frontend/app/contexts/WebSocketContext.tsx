'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Socket } from 'socket.io-client';
import { Loader2 } from 'lucide-react';
import { getAccessToken, hydrateSession, subscribeToSession } from '@/lib/session';
import { createWebSocketClient, WebSocketConnectionStatus } from '@/lib/websocket';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  connectionError: string | null;
  /** Coarse status for UI indicators: connected / reconnecting / disconnected. */
  connectionStatus: WebSocketConnectionStatus;
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  isConnected: false,
  connectionError: null,
  connectionStatus: 'disconnected',
});

export const useWebSocket = () => useContext(WebSocketContext);
export const useGlobalWebSocket = useWebSocket;

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<WebSocketConnectionStatus>('disconnected');
  const [authToken, setAuthToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    hydrateSession();
    return getAccessToken();
  });

  useEffect(() => {
    hydrateSession();
    setAuthToken(getAccessToken());
    return subscribeToSession(() => {
      setAuthToken(getAccessToken());
    });
  }, []);

  useEffect(() => {
    const legacyToken =
      typeof window !== 'undefined'
        ? localStorage.getItem('authToken')
        : null;
    const token = authToken ?? legacyToken;

    const socketInstance = createWebSocketClient(token);

    socketInstance.on('connect', () => {
      setIsConnected(true);
      setConnectionError(null);
      setConnectionStatus('connected');
    });

    socketInstance.on('disconnect', (reason) => {
      setIsConnected(false);
      setConnectionStatus('reconnecting');
      if (reason === 'io server disconnect') {
        socketInstance.connect();
      }
    });

    socketInstance.on('connect_error', (err) => {
      setIsConnected(false);
      setConnectionError(err.message);
      setConnectionStatus('reconnecting');
    });

    socketInstance.io.on('reconnect_failed', () => {
      setConnectionStatus('disconnected');
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.removeAllListeners();
      socketInstance.io.removeAllListeners();
      socketInstance.disconnect();
    };
  }, [authToken]);

  const showReconnectBanner = authToken !== null && !isConnected;
  // Without a token there's nothing to reconnect to — report plain
  // "disconnected" rather than a perpetual "reconnecting" from the
  // socket's own auth-rejection retry loop.
  const effectiveStatus: WebSocketConnectionStatus =
    authToken === null ? 'disconnected' : connectionStatus;

  return (
    <WebSocketContext.Provider
      value={{
        socket,
        isConnected,
        connectionError,
        connectionStatus: effectiveStatus,
      }}
    >
      {children}
      {showReconnectBanner && (
        <div 
          aria-live="polite"
          className="fixed bottom-0 left-0 w-full bg-amber-500 text-white text-center py-2 text-sm font-semibold shadow-lg z-[100] flex items-center justify-center gap-2 animate-in slide-in-from-bottom"
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          Reconnecting to live updates... {connectionError && `(${connectionError})`}
        </div>
      )}
    </WebSocketContext.Provider>
  );
};
