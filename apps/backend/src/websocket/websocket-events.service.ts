import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Server } from 'socket.io';
import {
  WsEvent,
  EscrowStatusChangedPayload,
  ConditionPayload,
  DisputePayload,
  DisputeResolvedPayload,
  NotificationPayload,
} from './events.gateway';

@Injectable()
export class WebSocketEventsService implements OnModuleInit {
  private server: Server | null = null;
  private readonly logger = new Logger(WebSocketEventsService.name);

  // In-memory store for recent events (for reconnection support)
  // Keyed by escrowId or userId for notifications
  private readonly recentEvents: Map<
    string,
    Array<{ event: string; payload: unknown; timestamp: number }>
  > = new Map();
  private readonly maxEventsPerKey = 50;
  private readonly eventTtlMs = 5 * 60 * 1000; // 5 minutes

  onModuleInit(): void {
    // Clean up old events periodically
    setInterval(() => this.cleanupOldEvents(), 60000); // Every minute
  }

  setServer(server: Server): void {
    this.server = server;
    this.logger.log('WebSocket server reference set');
  }

  /**
   * Emit escrow status change event to all subscribers
   */
  emitEscrowStatusChanged(payload: EscrowStatusChangedPayload): void {
    const eventName = WsEvent.ESCROW_STATUS_CHANGED;
    this.storeEvent(`escrow:${payload.escrowId}`, eventName, payload);
    this.emitToRoom(`escrow:${payload.escrowId}`, eventName, payload);

    // Also emit to the depositor and recipient user channels
    if (payload.actorId) {
      this.emitToRoom(`user:${payload.actorId}`, eventName, payload);
    }

    this.logger.debug(
      `Emitted ${eventName} for escrow ${payload.escrowId}: ${payload.previousStatus} -> ${payload.newStatus}`,
    );
  }

  /**
   * Emit condition fulfilled event
   */
  emitConditionFulfilled(payload: ConditionPayload): void {
    const eventName = WsEvent.ESCROW_CONDITION_FULFILLED;
    this.storeEvent(`escrow:${payload.escrowId}`, eventName, payload);
    this.emitToRoom(`escrow:${payload.escrowId}`, eventName, payload);

    this.logger.debug(
      `Emitted ${eventName} for condition ${payload.conditionId} in escrow ${payload.escrowId}`,
    );
  }

  /**
   * Emit condition confirmed event
   */
  emitConditionConfirmed(payload: ConditionPayload): void {
    const eventName = WsEvent.ESCROW_CONDITION_CONFIRMED;
    this.storeEvent(`escrow:${payload.escrowId}`, eventName, payload);
    this.emitToRoom(`escrow:${payload.escrowId}`, eventName, payload);

    this.logger.debug(
      `Emitted ${eventName} for condition ${payload.conditionId} in escrow ${payload.escrowId}`,
    );
  }

  /**
   * Emit dispute filed event
   */
  emitDisputeFiled(payload: DisputePayload): void {
    const eventName = WsEvent.ESCROW_DISPUTE_FILED;
    this.storeEvent(`escrow:${payload.escrowId}`, eventName, payload);
    this.emitToRoom(`escrow:${payload.escrowId}`, eventName, payload);

    // Also emit to the filing user
    this.emitToRoom(`user:${payload.filedBy}`, eventName, payload);

    this.logger.debug(`Emitted ${eventName} for escrow ${payload.escrowId}`);
  }

  /**
   * Emit dispute resolved event
   */
  emitDisputeResolved(payload: DisputeResolvedPayload): void {
    const eventName = WsEvent.ESCROW_DISPUTE_RESOLVED;
    this.storeEvent(`escrow:${payload.escrowId}`, eventName, payload);
    this.emitToRoom(`escrow:${payload.escrowId}`, eventName, payload);

    // Also emit to the resolver user
    this.emitToRoom(`user:${payload.resolvedBy}`, eventName, payload);

    this.logger.debug(`Emitted ${eventName} for escrow ${payload.escrowId}`);
  }

  /**
   * Emit new notification to a specific user
   */
  emitNotification(payload: NotificationPayload): void {
    const eventName = WsEvent.NOTIFICATION_NEW;
    this.storeEvent(`user:${payload.userId}`, eventName, payload);
    this.emitToRoom(`user:${payload.userId}`, eventName, payload);

    this.logger.debug(`Emitted ${eventName} to user ${payload.userId}`);
  }

  /**
   * Get missed events for a user since a given timestamp
   */
  getMissedEvents(
    key: string,
    sinceTimestamp: number,
  ): Array<{ event: string; payload: unknown }> {
    const events = this.recentEvents.get(key);
    if (!events) {
      return [];
    }

    return events
      .filter((e) => e.timestamp > sinceTimestamp)
      .map((e) => ({ event: e.event, payload: e.payload }));
  }

  /**
   * Get missed events for an escrow
   */
  getMissedEscrowEvents(
    escrowId: string,
    sinceTimestamp: number,
  ): Array<{ event: string; payload: unknown }> {
    return this.getMissedEvents(`escrow:${escrowId}`, sinceTimestamp);
  }

  /**
   * Get missed events for a user's notifications
   */
  getMissedUserEvents(
    userId: string,
    sinceTimestamp: number,
  ): Array<{ event: string; payload: unknown }> {
    return this.getMissedEvents(`user:${userId}`, sinceTimestamp);
  }

  /**
   * Emit to a specific room
   */
  private emitToRoom(room: string, event: string, payload: unknown): void {
    if (!this.server) {
      this.logger.warn('Cannot emit: WebSocket server not initialized');
      return;
    }

    this.server.to(room).emit(event, payload);
  }

  /**
   * Store event for reconnection support
   */
  private storeEvent(key: string, event: string, payload: unknown): void {
    if (!this.recentEvents.has(key)) {
      this.recentEvents.set(key, []);
    }

    const events = this.recentEvents.get(key)!;
    events.push({
      event,
      payload,
      timestamp: Date.now(),
    });

    // Trim to max size
    if (events.length > this.maxEventsPerKey) {
      events.shift();
    }
  }

  /**
   * Clean up old events past TTL
   */
  private cleanupOldEvents(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, events] of this.recentEvents.entries()) {
      const filtered = events.filter(
        (e) => now - e.timestamp < this.eventTtlMs,
      );
      if (filtered.length !== events.length) {
        cleaned += events.length - filtered.length;
        if (filtered.length === 0) {
          this.recentEvents.delete(key);
        } else {
          this.recentEvents.set(key, filtered);
        }
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} old events from memory`);
    }
  }
}
