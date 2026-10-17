/**
 * useEscrowEvents
 *
 * Subscribes to real-time escrow lifecycle events from the backend gateway
 * using the documented join/leave protocol.
 *
 * Protocol (see apps/backend/src/gateways/events.gateway.ts):
 *   - Join room:  emit `joinEscrow` with an escrowId and optional resume cursor
 *   - Leave room: emit `leaveEscrow` with a plain escrowId string
 *   - Join ack:   server emits `joinedEscrow` with { escrowId }
 *   - Subscription rejected: server emits `subscription:error` with { message }
 *
 * Server-emitted lifecycle events arrive with event data, cursor, and timestamp.
 *
 * Reconnect handling and post-auth identity refresh are included.
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGlobalWebSocket } from "@/app/contexts/WebSocketContext";
import {
  EscrowEventPayload,
  joinEscrowRoom,
  leaveEscrowRoom,
  storeEscrowCursor,
} from "@/lib/websocket";
import { toast } from "sonner";

interface UseEscrowEventsProps {
  escrowId?: string;
  /** @deprecated — kept for callers that still pass it; ignored internally */
  isSocketConnected?: boolean;
  setSocketConnected?: (connected: boolean) => void;
}

export function useEscrowEvents({
  escrowId,
  setSocketConnected,
}: UseEscrowEventsProps = {}) {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useGlobalWebSocket();

  // Track the escrowId we most recently joined so we can leave on cleanup or
  // re-join when the socket identity changes after auth rotation.
  const joinedEscrowRef = useRef<string | undefined>(undefined);

  // Propagate connection state to callers that request it.
  useEffect(() => {
    if (setSocketConnected) {
      setSocketConnected(isConnected);
    }

    if (isConnected) {
      // On (re)connect, invalidate all relevant query caches so the UI
      // reflects any updates that arrived while we were disconnected.
      if (escrowId) {
        queryClient.invalidateQueries({ queryKey: ["escrow", escrowId] });
      }
      queryClient.invalidateQueries({ queryKey: ["escrows"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  }, [isConnected, setSocketConnected, escrowId, queryClient]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    // ── Join the escrow room using the documented protocol ─────────────────
    // Register listeners before joining so replayed events are observed.
    // ── Subscription rejection handler ─────────────────────────────────────
    const handleSubscriptionError = (err: { message?: string }) => {
      toast.error(err.message || "Subscription to escrow updates was rejected.");
    };

    // ── Generic invalidation helper ────────────────────────────────────────
    const invalidateEscrowQueries = (eventEscrowId?: string) => {
      const targetId = eventEscrowId || escrowId;
      if (targetId) {
        queryClient.invalidateQueries({ queryKey: ["escrow", targetId] });
      }
      queryClient.invalidateQueries({ queryKey: ["escrows"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    };

    // ── Escrow status / lifecycle events ───────────────────────────────────
    const handleEscrowUpdate = (event: EscrowEventPayload) => {
      toast.info(event.message || "Escrow updated.");
      const targetId = event.escrowId || escrowId;
      invalidateEscrowQueries(targetId);

      // Optimistically apply any partial payload the server provides.
      if (event.payload && targetId) {
        queryClient.setQueryData(["escrow", targetId], (oldData: unknown) => {
          if (!oldData || typeof oldData !== "object") return oldData;
          return { ...(oldData as object), ...(event.payload as object) };
        });
      }
    };

    // ── Milestone events ───────────────────────────────────────────────────
    const handleMilestoneReleased = (event: EscrowEventPayload) => {
      toast.success(event.message || "Milestone released.");
      invalidateEscrowQueries(event.escrowId);
    };

    // ── Party / condition events ───────────────────────────────────────────
    const handlePartyOrConditionEvent = (event: EscrowEventPayload) => {
      toast.info(event.message || "Escrow updated.");
      invalidateEscrowQueries(event.escrowId);
    };

    const handlePersistCursor = (event: EscrowEventPayload) => {
      if (escrowId && typeof event.cursor === "string") {
        storeEscrowCursor(escrowId, event.cursor);
      }
      invalidateEscrowQueries(event.escrowId);
    };

    // Register all lifecycle events emitted by the gateway
    socket.on("escrow.event", handlePersistCursor);
    socket.on("escrow.status_changed", handleEscrowUpdate);
    socket.on("escrow.funded", handleEscrowUpdate);
    socket.on("escrow.completed", handleEscrowUpdate);
    socket.on("escrow.cancelled", handleEscrowUpdate);
    socket.on("escrow.dispute_filed", handleEscrowUpdate);
    socket.on("escrow.dispute_resolved", handleEscrowUpdate);
    socket.on("escrow.milestone_released", handleMilestoneReleased);
    socket.on("escrow.party_joined", handlePartyOrConditionEvent);
    socket.on("escrow.condition_fulfilled", handlePartyOrConditionEvent);
    socket.on("escrow.condition_confirmed", handlePartyOrConditionEvent);
    socket.on("subscription:error", handleSubscriptionError);

    if (escrowId) {
      joinEscrowRoom(socket, escrowId);
      joinedEscrowRef.current = escrowId;
    }

    return () => {
      // ── Leave the escrow room on unmount / dependency change ─────────────
      if (joinedEscrowRef.current) {
        leaveEscrowRoom(socket, joinedEscrowRef.current);
        joinedEscrowRef.current = undefined;
      }

      socket.off("escrow.event", handlePersistCursor);
      socket.off("escrow.status_changed", handleEscrowUpdate);
      socket.off("escrow.funded", handleEscrowUpdate);
      socket.off("escrow.completed", handleEscrowUpdate);
      socket.off("escrow.cancelled", handleEscrowUpdate);
      socket.off("escrow.dispute_filed", handleEscrowUpdate);
      socket.off("escrow.dispute_resolved", handleEscrowUpdate);
      socket.off("escrow.milestone_released", handleMilestoneReleased);
      socket.off("escrow.party_joined", handlePartyOrConditionEvent);
      socket.off("escrow.condition_fulfilled", handlePartyOrConditionEvent);
      socket.off("escrow.condition_confirmed", handlePartyOrConditionEvent);
      socket.off("subscription:error", handleSubscriptionError);
    };
  }, [socket, isConnected, escrowId, queryClient]);

  return { isConnected };
}
