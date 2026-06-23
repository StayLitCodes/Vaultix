import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner"; // Or your preferred toast provider

interface UseEscrowWebSocketProps {
  escrowId: string;
  isSocketConnected: boolean;
  setSocketConnected: (connected: boolean) => void;
}

// Global or shared socket instance connection configuration
let socket: Socket | null = null;

export function useEscrowWebSocket({
  escrowId,
  isSocketConnected,
  setSocketConnected,
}: UseEscrowWebSocketProps) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!escrowId) return;

    // Fallback environment targets for standard infrastructure orchestration
    const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";

    if (!socket) {
      socket = io(WEBSOCKET_URL, {
        transports: ["websocket"],
        autoConnect: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
      });
    }

    // Connect lifecycle configurations
    socket.on("connect", () => {
      setSocketConnected(true);
      // Join the designated escrow isolation workspace room
      socket?.emit("escrow:join", { id: escrowId });
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
    });

    socket.on("connect_error", () => {
      setSocketConnected(false);
    });

    // ── Live Event Subscriptions & Cache Mutation Orchestrations ──
    
    const handleEscrowUpdate = (event: { type: string; message: string; payload?: any }) => {
      // Subtle push alert feedback notifications
      toast.info(event.message || "Escrow pipeline state update received.");

      // Invalidate and background refetch standard cache line to guarantee complete state integrity
      queryClient.invalidateQueries({ queryKey: ["escrow", escrowId] });

      // Optimistic layout mutation mapping depending on payload structure
      if (event.payload) {
        queryClient.setQueryData(["escrow", escrowId], (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            ...event.payload,
            // Deep array updates are merged cleanly via the incoming refetch cascade
          };
        });
      }
    };

    socket.on("escrow:status_changed", handleEscrowUpdate);
    socket.on("escrow:funded", handleEscrowUpdate);
    socket.on("escrow:completed", handleEscrowUpdate);
    socket.on("escrow:dispute_filed", handleEscrowUpdate);
    socket.on("escrow:dispute_resolved", handleEscrowUpdate);

    // Explicitly connect if initialized in a dormant state
    if (socket.disconnected) {
      socket.connect();
    } else if (socket.connected) {
      setSocketConnected(true);
      socket.emit("escrow:join", { id: escrowId });
    }

    // Cleanup teardown lifecycle pipeline: leave isolation workspace room on component unmount
    return () => {
      if (socket) {
        socket.emit("escrow:leave", { id: escrowId });
        socket.off("connect");
        socket.off("disconnect");
        socket.off("connect_error");
        socket.off("escrow:status_changed", handleEscrowUpdate);
        socket.off("escrow:funded", handleEscrowUpdate);
        socket.off("escrow:completed", handleEscrowUpdate);
        socket.off("escrow:dispute_filed", handleEscrowUpdate);
        socket.off("escrow:dispute_resolved", handleEscrowUpdate);
      }
    };
  }, [escrowId, queryClient, setSocketConnected]);
}