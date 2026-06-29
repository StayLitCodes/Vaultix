import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGlobalWebSocket } from "@/app/contexts/WebSocketContext";
import { toast } from "sonner";

interface UseEscrowWebSocketProps {
  escrowId?: string;
  isSocketConnected?: boolean;
  setSocketConnected?: (connected: boolean) => void;
}

export function useEscrowWebSocket({
  escrowId,
  setSocketConnected,
}: UseEscrowWebSocketProps = {}) {
  const queryClient = useQueryClient();
  
  const { socket, isConnected } = useGlobalWebSocket();

  useEffect(() => {
    if (setSocketConnected) {
      setSocketConnected(isConnected);
    }
    
    if (isConnected) {
      if (escrowId) {
        queryClient.invalidateQueries({ queryKey: ["escrow", escrowId] });
      }
      queryClient.invalidateQueries({ queryKey: ["escrows"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  }, [isConnected, setSocketConnected, escrowId, queryClient]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    if (escrowId) {
      socket.emit("escrow:join", { id: escrowId });
    }

    const handleEscrowUpdate = (event: { type: string; message: string; payload?: any; escrowId?: string }) => {
      toast.info(event.message || "Escrow pipeline state update received.");
      
      const targetId = event.escrowId || escrowId;

      if (targetId) {
        queryClient.invalidateQueries({ queryKey: ["escrow", targetId] });
      }
      
      queryClient.invalidateQueries({ queryKey: ["escrows"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });

      if (event.payload && targetId) {
        queryClient.setQueryData(["escrow", targetId], (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            ...event.payload,
          };
        });
      }
    };

    socket.on("escrow:status_changed", handleEscrowUpdate);
    socket.on("escrow:funded", handleEscrowUpdate);
    socket.on("escrow:completed", handleEscrowUpdate);
    socket.on("escrow:dispute_filed", handleEscrowUpdate);
    socket.on("escrow:dispute_resolved", handleEscrowUpdate);

    return () => {
      if (escrowId) {
        socket.emit("escrow:leave", { id: escrowId });
      }
      socket.off("escrow:status_changed", handleEscrowUpdate);
      socket.off("escrow:funded", handleEscrowUpdate);
      socket.off("escrow:completed", handleEscrowUpdate);
      socket.off("escrow:dispute_filed", handleEscrowUpdate);
      socket.off("escrow:dispute_resolved", handleEscrowUpdate);
    };
  }, [socket, isConnected, escrowId, queryClient]);

  return { isConnected };
}