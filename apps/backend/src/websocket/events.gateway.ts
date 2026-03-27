import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WebSocketEventsService } from './websocket-events.service';
import { ConfigService } from '@nestjs/config';

// Event names for type safety
export enum WsEvent {
  // Escrow events
  ESCROW_STATUS_CHANGED = 'escrow.status_changed',
  ESCROW_CONDITION_FULFILLED = 'escrow.condition_fulfilled',
  ESCROW_CONDITION_CONFIRMED = 'escrow.condition_confirmed',
  ESCROW_DISPUTE_FILED = 'escrow.dispute_filed',
  ESCROW_DISPUTE_RESOLVED = 'escrow.dispute_resolved',
  // Notification events
  NOTIFICATION_NEW = 'notification.new',
  // Connection events
  SUBSCRIBE_ESCROW = 'subscribe:escrow',
  UNSUBSCRIBE_ESCROW = 'unsubscribe:escrow',
  SUBSCRIBE_NOTIFICATIONS = 'subscribe:notifications',
  MISSED_EVENTS = 'missed_events',
}

// Payload interfaces
export interface EscrowStatusChangedPayload {
  escrowId: string;
  previousStatus: string;
  newStatus: string;
  timestamp: Date;
  actorId?: string;
  metadata?: Record<string, unknown>;
}

export interface ConditionPayload {
  escrowId: string;
  conditionId: string;
  description?: string;
  fulfilledBy?: string;
  confirmedBy?: string;
  timestamp: Date;
}

export interface DisputePayload {
  escrowId: string;
  disputeId: string;
  filedBy: string;
  reason?: string;
  timestamp: Date;
}

export interface DisputeResolvedPayload {
  escrowId: string;
  disputeId: string;
  outcome: string;
  resolvedBy: string;
  timestamp: Date;
}

export interface NotificationPayload {
  notificationId: string;
  userId: string;
  eventType: string;
  message: string;
  escrowId?: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

interface SocketData {
  user: {
    userId: string;
    walletAddress: string;
  };
  subscribedEscrows?: Set<string>;
  subscribedNotifications?: boolean;
  lastEventTimestamp?: number;
}

interface AuthenticatedSocket extends Socket {
  data: SocketData;
}

@WebSocketGateway({
  namespace: '/events',
  cors: {
    origin: true, // Allow all origins in development; configure for production
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly wsEventsService: WebSocketEventsService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: Server): void {
    this.logger.log('WebSocket Gateway initialized on namespace /events');
    // Make the server available to the events service
    this.wsEventsService.setServer(server);
  }

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      // Extract token and validate
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn(
          `Connection rejected: No token. Socket ID: ${client.id}`,
        );
        client.emit('error', { message: 'Authentication required' });
        client.disconnect(true);
        return;
      }

      // Verify token manually for connection validation
      const jwt = await import('jsonwebtoken');
      const secret = this.configService.get<string>(
        'JWT_SECRET',
        'your-secret-key-change-in-production',
      );

      const payload = jwt.verify(token, secret) as {
        sub: string;
        walletAddress: string;
        type: string;
      };

      if (payload.type !== 'access') {
        throw new Error('Invalid token type');
      }

      // Initialize socket data
      client.data = {
        user: {
          userId: payload.sub,
          walletAddress: payload.walletAddress,
        },
        subscribedEscrows: new Set(),
        subscribedNotifications: false,
        lastEventTimestamp: Date.now(),
      };

      this.logger.log(
        `Client connected: userId=${payload.sub}, socketId=${client.id}`,
      );

      // Join user's personal notification room
      void client.join(`user:${payload.sub}`);

      // Send connection confirmation
      client.emit('connection:established', {
        message: 'Connected to Vaultix events stream',
        userId: payload.sub,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Connection rejected: ${errorMessage}. Socket ID: ${client.id}`,
      );
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    const userId = client.data?.user?.userId;
    this.logger.log(
      `Client disconnected: userId=${userId}, socketId=${client.id}`,
    );
  }

  @SubscribeMessage(WsEvent.SUBSCRIBE_ESCROW)
  handleSubscribeEscrow(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { escrowId: string },
  ): void {
    if (!data?.escrowId) {
      throw new WsException('escrowId is required');
    }

    const room = `escrow:${data.escrowId}`;
    void client.join(room);
    client.data.subscribedEscrows?.add(data.escrowId);

    this.logger.debug(
      `Client subscribed to escrow: userId=${client.data.user.userId}, escrowId=${data.escrowId}`,
    );

    client.emit('subscribed', {
      room,
      escrowId: data.escrowId,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage(WsEvent.UNSUBSCRIBE_ESCROW)
  handleUnsubscribeEscrow(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { escrowId: string },
  ): void {
    if (!data?.escrowId) {
      throw new WsException('escrowId is required');
    }

    const room = `escrow:${data.escrowId}`;
    void client.leave(room);
    client.data.subscribedEscrows?.delete(data.escrowId);

    this.logger.debug(
      `Client unsubscribed from escrow: userId=${client.data.user.userId}, escrowId=${data.escrowId}`,
    );

    client.emit('unsubscribed', {
      room,
      escrowId: data.escrowId,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage(WsEvent.SUBSCRIBE_NOTIFICATIONS)
  handleSubscribeNotifications(
    @ConnectedSocket() client: AuthenticatedSocket,
  ): void {
    client.data.subscribedNotifications = true;

    this.logger.debug(
      `Client subscribed to notifications: userId=${client.data.user.userId}`,
    );

    client.emit('notifications:subscribed', {
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket): void {
    client.emit('pong', { timestamp: Date.now() });
  }

  private extractToken(client: Socket): string | null {
    // Try authorization header first
    const authHeader = client.handshake.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try query parameter
    const tokenFromQuery = client.handshake.query.token;
    if (typeof tokenFromQuery === 'string' && tokenFromQuery) {
      return tokenFromQuery;
    }

    // Try auth object in handshake
    const auth = client.handshake.auth;
    if (auth?.token && typeof auth.token === 'string') {
      return auth.token;
    }

    return null;
  }
}
