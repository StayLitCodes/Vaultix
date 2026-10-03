import { io, Socket } from 'socket.io-client';

/**
 * Shared client for the backend's Socket.IO `/events` namespace
 * (apps/backend/src/gateways/events.gateway.ts). Centralizes connection
 * setup, the typed event map, and the escrow room join/leave protocol so
 * every hook/provider that touches the socket agrees on event names and
 * payload shapes.
 */

export type WebSocketConnectionStatus =
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

export interface EscrowEventPayload {
  escrowId?: string;
  eventType?: string;
  cursor?: string;
  status?: string;
  previousStatus?: string;
  message?: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface NotificationEventPayload {
  id?: string;
  userId?: string;
  eventType?: string;
  payload?: Record<string, unknown>;
  status?: 'pending' | 'sent' | 'failed';
  escrowId?: string;
  retryCount?: number;
  readAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

/** Every event the gateway can emit, keyed by its exact wire name. */
export interface WebSocketEventMap {
  connected: { userId: string; socketId: string };
  joinedEscrow: { escrowId: string };
  'subscription:error': { message?: string };
  'events.missed': { escrowId: string; events: EscrowEventPayload[] };
  'escrow.event': EscrowEventPayload;
  'escrow.status_changed': EscrowEventPayload;
  'escrow.funded': EscrowEventPayload;
  'escrow.completed': EscrowEventPayload;
  'escrow.cancelled': EscrowEventPayload;
  'escrow.milestone_released': EscrowEventPayload;
  'escrow.party_joined': EscrowEventPayload;
  'escrow.condition_fulfilled': EscrowEventPayload;
  'escrow.condition_confirmed': EscrowEventPayload;
  'escrow.dispute_filed': EscrowEventPayload;
  'escrow.dispute_resolved': EscrowEventPayload;
  'notification.new': NotificationEventPayload;
}

const DEFAULT_WEBSOCKET_URL = 'http://localhost:3000';
const NAMESPACE = '/events';

/** Creates the shared Socket.IO client with exponential-backoff reconnection. */
export function createWebSocketClient(token?: string | null): Socket {
  const baseUrl = (
    process.env.NEXT_PUBLIC_WS_URL || DEFAULT_WEBSOCKET_URL
  ).replace(/\/$/, '');

  return io(`${baseUrl}${NAMESPACE}`, {
    transports: ['websocket'],
    auth: { token: token ?? undefined },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    randomizationFactor: 0.5,
  });
}

/** Type-safe `socket.on` that returns an unsubscribe function. */
export function onEvent<K extends keyof WebSocketEventMap>(
  socket: Socket,
  event: K,
  handler: (payload: WebSocketEventMap[K]) => void,
): () => void {
  socket.on(event as string, handler as (...args: unknown[]) => void);
  return () => {
    socket.off(event as string, handler as (...args: unknown[]) => void);
  };
}

// ── Escrow room subscriptions ────────────────────────────────────────────
// Room format: `escrow:{escrowId}` (joined/left server-side via these
// message names; see EventsGateway.joinEscrow/leaveEscrow).

function escrowCursorKey(escrowId: string): string {
  return `vaultix:events:${escrowId}`;
}

/** Last event cursor we've seen for this escrow, so a rejoin can resume from it. */
export function getStoredEscrowCursor(escrowId: string): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage.getItem(escrowCursorKey(escrowId)) ?? undefined;
}

export function storeEscrowCursor(escrowId: string, cursor?: string): void {
  if (typeof window === 'undefined' || !cursor) return;
  window.localStorage.setItem(escrowCursorKey(escrowId), cursor);
}

export function joinEscrowRoom(socket: Socket, escrowId: string): void {
  socket.emit('joinEscrow', {
    escrowId,
    afterCursor: getStoredEscrowCursor(escrowId),
  });
}

export function leaveEscrowRoom(socket: Socket, escrowId: string): void {
  socket.emit('leaveEscrow', escrowId);
}
