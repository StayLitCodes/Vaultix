import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { EscrowEvent } from '../modules/escrow/entities/escrow-event.entity';

interface EscrowEventData {
  [key: string]: unknown;
}

interface JwtPayload {
  sub?: string;
  userId?: string;
  id?: string;
}

interface ClientAuthPayload {
  token?: string;
}

interface ReconnectPayload {
  escrowIds?: string[];
  lastCursor?: string;
}

@WebSocketGateway({
  namespace: '/events',
  cors: {
    origin: (typeof process !== 'undefined' &&
      process.env.FRONTEND_URL?.split(',')) || ['http://localhost:3001'],
    credentials: true,
  },
})
export class EscrowGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EscrowGateway.name);
  private readonly userSocketMap = new Map<string, Set<string>>();
  private readonly socketUserMap = new Map<string, string>();
  private readonly socketEscrowMap = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(EscrowEvent)
    private readonly eventRepository: Repository<EscrowEvent>,
  ) {}

  private extractToken(client: Socket): string | undefined {
    const authPayload = client.handshake.auth as ClientAuthPayload | undefined;
    const authorizationHeader = client.handshake.headers.authorization;

    if (authPayload?.token) {
      return authPayload.token;
    }

    const parts = authorizationHeader?.split(' ') ?? [];
    return parts[1];
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);

      if (!token) {
        this.logger.warn(
          `Connection rejected: no token provided (${client.id})`,
        );
        client.disconnect();
        return;
      }

      let decoded: unknown;
      try {
        decoded = this.jwtService.verify(token);
      } catch {
        this.logger.warn(`Connection rejected: invalid token (${client.id})`);
        client.disconnect();
        return;
      }

      if (
        !decoded ||
        typeof decoded !== 'object' ||
        !('sub' in decoded || 'userId' in decoded || 'id' in decoded)
      ) {
        this.logger.warn(`Connection rejected: invalid token (${client.id})`);
        client.disconnect();
        return;
      }

      const payload = decoded as JwtPayload;
      const userId = payload.sub || payload.userId || payload.id;

      if (!userId) {
        this.logger.warn(`Connection rejected: invalid token (${client.id})`);
        client.disconnect();
        return;
      }

      this.socketUserMap.set(client.id, userId);
      const socketsForUser =
        this.userSocketMap.get(userId) || new Set<string>();
      socketsForUser.add(client.id);
      this.userSocketMap.set(userId, socketsForUser);

      await client.join(`user:${userId}`);
      this.logger.log(`Client connected: ${client.id} (user: ${userId})`);
      client.emit('connected', {
        userId,
        socketId: client.id,
        namespace: '/events',
      });
    } catch (error: unknown) {
      this.logger.error(
        `Connection rejected: invalid token (${client.id})`,
        error,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = this.socketUserMap.get(client.id);

    if (userId) {
      const socketsForUser = this.userSocketMap.get(userId);
      if (socketsForUser) {
        socketsForUser.delete(client.id);
        if (socketsForUser.size === 0) {
          this.userSocketMap.delete(userId);
        } else {
          this.userSocketMap.set(userId, socketsForUser);
        }
      }

      this.socketUserMap.delete(client.id);
      const escrowIds =
        this.socketEscrowMap.get(client.id) || new Set<string>();
      escrowIds.forEach((escrowId) => {
        void client.leave(`escrow:${escrowId}`);
      });
      this.socketEscrowMap.delete(client.id);

      this.logger.log(`Client disconnected: ${client.id} (user: ${userId})`);
    }
  }

  @SubscribeMessage('joinEscrow')
  async handleJoinEscrow(client: Socket, escrowId: string): Promise<void> {
    if (!escrowId) {
      return;
    }

    const room = `escrow:${escrowId}`;
    await client.join(room);

    const escrowIds = this.socketEscrowMap.get(client.id) || new Set<string>();
    escrowIds.add(escrowId);
    this.socketEscrowMap.set(client.id, escrowIds);

    this.logger.log(`Client ${client.id} joined escrow room: ${escrowId}`);
    client.emit('joinedEscrow', { escrowId });
  }

  @SubscribeMessage('leaveEscrow')
  async handleLeaveEscrow(client: Socket, escrowId: string): Promise<void> {
    if (!escrowId) {
      return;
    }

    await client.leave(`escrow:${escrowId}`);

    const escrowIds = this.socketEscrowMap.get(client.id);
    if (escrowIds) {
      escrowIds.delete(escrowId);
      if (escrowIds.size === 0) {
        this.socketEscrowMap.delete(client.id);
      } else {
        this.socketEscrowMap.set(client.id, escrowIds);
      }
    }

    this.logger.log(`Client ${client.id} left escrow room: ${escrowId}`);
  }

  @SubscribeMessage('reconnect')
  async handleReconnect(
    client: Socket,
    payload: ReconnectPayload,
  ): Promise<void> {
    if (payload?.escrowIds?.length) {
      for (const escrowId of payload.escrowIds) {
        await this.handleJoinEscrow(client, escrowId);
      }
    }

    const userId = this.socketUserMap.get(client.id);
    const missedEvents = await this.findMissedEvents(
      userId,
      payload?.escrowIds,
      payload?.lastCursor,
    );
    client.emit('reconnected', {
      userId,
      socketId: client.id,
      missedEvents,
      latestCursor:
        missedEvents[missedEvents.length - 1]?.cursor ?? payload?.lastCursor,
    });
  }

  private async findMissedEvents(
    userId?: string,
    escrowIds?: string[],
    lastCursor?: string,
  ): Promise<EscrowEvent[]> {
    if (
      !userId ||
      !escrowIds?.length ||
      !lastCursor ||
      !/^\d+$/.test(lastCursor)
    ) {
      return [];
    }

    return this.eventRepository
      .createQueryBuilder('event')
      .innerJoin('event.escrow', 'escrow')
      .leftJoin('escrow.parties', 'party')
      .where('event.escrowId IN (:...escrowIds)', { escrowIds })
      .andWhere('event.cursor > :lastCursor', { lastCursor })
      .andWhere('(escrow.creatorId = :userId OR party.userId = :userId)', {
        userId,
      })
      .orderBy('event.cursor', 'ASC')
      .take(100)
      .getMany();
  }

  broadcastEscrowStatusChanged(escrowId: string, data: EscrowEventData): void {
    this.emitToEscrowRoom('escrow.status_changed', escrowId, data);
  }

  broadcastConditionFulfilled(escrowId: string, data: EscrowEventData): void {
    this.emitToEscrowRoom('escrow.condition_fulfilled', escrowId, data);
  }

  broadcastConditionConfirmed(escrowId: string, data: EscrowEventData): void {
    this.emitToEscrowRoom('escrow.condition_confirmed', escrowId, data);
  }

  broadcastDisputeFiled(escrowId: string, data: EscrowEventData): void {
    this.emitToEscrowRoom('escrow.dispute_filed', escrowId, data);
  }

  broadcastDisputeResolved(escrowId: string, data: EscrowEventData): void {
    this.emitToEscrowRoom('escrow.dispute_resolved', escrowId, data);
  }

  broadcastNotification(userId: string, data: EscrowEventData): void {
    const payload = {
      ...data,
      userId,
      timestamp: new Date().toISOString(),
    };

    this.server.to(`user:${userId}`).emit('notification.new', payload);
  }

  getOnlineUsers(): Map<string, Set<string>> {
    return this.userSocketMap;
  }

  getUserSockets(userId: string): string[] {
    return Array.from(this.userSocketMap.get(userId) || []);
  }

  isUserOnline(userId: string): boolean {
    return (this.userSocketMap.get(userId)?.size || 0) > 0;
  }

  isHealthy(): boolean {
    return this.server !== undefined;
  }

  private emitToEscrowRoom(
    eventName: string,
    escrowId: string,
    data: EscrowEventData,
  ): void {
    this.server.to(`escrow:${escrowId}`).emit(eventName, {
      escrowId,
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
}
