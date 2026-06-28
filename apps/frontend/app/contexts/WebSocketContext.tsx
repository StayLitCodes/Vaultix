'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { Loader2 } from 'lucide-react';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  connectionError: string | null;
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  isConnected: false,
  connectionError: null,
});

export const useGlobalWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';
    
    const socketInstance = io(WEBSOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.5,
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
      setConnectionError(null);
    });

    socketInstance.on('disconnect', (reason) => {
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        socketInstance.connect();
      }
    });

    socketInstance.on('connect_error', (err) => {
      setIsConnected(false);
      setConnectionError(err.message);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ socket, isConnected, connectionError }}>
      {children}
      {!isConnected && (
        <div className="fixed bottom-0 left-0 w-full bg-amber-500 text-white text-center py-2 text-sm font-semibold shadow-lg z-[100] flex items-center justify-center gap-2 animate-in slide-in-from-bottom">
          <Loader2 className="w-4 h-4 animate-spin" />
          Reconnecting to live updates... {connectionError && `(${connectionError})`}
        </div>
      )}
    </WebSocketContext.Provider>
  );
};