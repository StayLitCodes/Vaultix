import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Namespace, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { Escrow } from '../modules/escrow/entities/escrow.entity';
import { EscrowEvent } from '../modules/escrow/entities/escrow-event.entity';
import { Party } from '../modules/escrow/entities/party.entity';

type JwtPayload = { sub?: string; userId?: string; type?: string };
type EscrowJoinRequest = string | { escrowId: string; afterCursor?: string };
const websocketOrigins = (
  process.env.CORS_ORIGINS ||
  process.env.FRONTEND_URL ||
  'http://localhost:3000,http://localhost:3001'
)
  .split(',')
  .map((origin) => origin.trim());

@WebSocketGateway({
  namespace: '/events',
  cors: {
    origin: websocketOrigins.includes('*') ? true : websocketOrigins,
    credentials: true,
  },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Namespace;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(EscrowEvent)
    private readonly eventRepository: Repository<EscrowEvent>,
    @InjectRepository(Escrow)
    private readonly escrowRepository: Repository<Escrow>,
    @InjectRepository(Party)
    private readonly partyRepository: Repository<Party>,
  ) {}

  afterInit(server: Namespace): void {
    server.use((client, next) => {
      const auth = client.handshake.auth as { token?: unknown } | undefined;
      const authToken = auth?.token;
      const header = client.handshake.headers.authorization;
      const token =
        (typeof authToken === 'string' ? authToken : undefined) ||
        (typeof header === 'string' ? header.replace(/^Bearer\s+/i, '') : '');

      if (!token) return next(new Error('Authentication required'));

      try {
        const payload = this.jwtService.verify<JwtPayload>(token);
        const userId = payload.sub || payload.userId;
        if (!userId || payload.type !== 'access') {
          return next(new Error('Invalid authentication token'));
        }
        (client.data as { userId?: string }).userId = userId;
        return next();
      } catch {
        return next(new Error('Invalid authentication token'));
      }
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    const userId = this.getSocketUserId(client);
    // The namespace middleware rejects unauthenticated sockets before this hook.
    if (!userId) {
      client.disconnect(true);
      return;
    }
    await client.join(this.userRoom(userId));
    this.logger.log(`Client connected: ${client.id} (user: ${userId})`);
    client.emit('connected', { userId, socketId: client.id });
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(
      `Client disconnected: ${client.id} (user: ${this.getSocketUserId(client) || 'unknown'})`,
    );
  }

  @SubscribeMessage('joinEscrow')
  async joinEscrow(
    @ConnectedSocket() client: Socket,
    @MessageBody() request: EscrowJoinRequest,
  ): Promise<{ event: string; data: { escrowId: string } }> {
    const userId = this.getSocketUserId(client);
    if (!userId) {
      client.emit('subscription:error', { message: 'Authentication required' });
      return {
        event: 'subscription:error',
        data: { escrowId: '' },
      };
    }
    const escrowId = typeof request === 'string' ? request : request?.escrowId;
    if (!escrowId || !(await this.canAccessEscrow(escrowId, userId))) {
      client.emit('subscription:error', {
        message: 'Escrow not found or access denied',
      });
      return {
        event: 'subscription:error',
        data: { escrowId: escrowId || '' },
      };
    }

    await client.join(this.escrowRoom(escrowId));
    client.emit('joinedEscrow', { escrowId });

    if (typeof request !== 'string' && request.afterCursor) {
      await this.replayEscrowEvents(client, escrowId, request.afterCursor);
    }

    return { event: 'joinedEscrow', data: { escrowId } };
  }

  @SubscribeMessage('leaveEscrow')
  async leaveEscrow(
    @ConnectedSocket() client: Socket,
    @MessageBody() request: string | { escrowId: string },
  ): Promise<void> {
    const escrowId = typeof request === 'string' ? request : request?.escrowId;
    if (escrowId) await client.leave(this.escrowRoom(escrowId));
  }

  emitEscrowEvent(event: EscrowEvent): void {
    const base = {
      escrowId: event.escrowId,
      eventId: event.id,
      cursor: event.cursor,
      eventType: event.eventType,
      actorId: event.actorId,
      data: event.data,
      timestamp: event.createdAt,
    };
    const room = this.escrowRoom(event.escrowId);
    this.server.to(room).emit('escrow.event', base);
    const specificEvent = this.eventName(event.eventType);
    if (specificEvent) this.server.to(room).emit(specificEvent, base);

    const status = this.statusForEvent(event);
    if (status) {
      this.server.to(room).emit('escrow.status_changed', {
        ...base,
        previousStatus:
          typeof event.data?.previousStatus === 'string'
            ? event.data.previousStatus
            : undefined,
        status,
      });
    }
  }

  emitNotification(userId: string, notification: unknown): void {
    this.server.to(this.userRoom(userId)).emit('notification.new', {
      ...(notification && typeof notification === 'object' ? notification : {}),
      timestamp: new Date().toISOString(),
    });
  }

  isHealthy(): boolean {
    return Boolean(this.server);
  }

  private async canAccessEscrow(
    escrowId: string,
    userId: string,
  ): Promise<boolean> {
    const escrow = await this.escrowRepository.findOne({
      where: { id: escrowId },
      select: { id: true, creatorId: true },
    });
    if (!escrow) return false;
    if (escrow.creatorId === userId) return true;
    return !!(await this.partyRepository.findOne({
      where: { escrowId, userId },
    }));
  }

  private async replayEscrowEvents(
    client: Socket,
    escrowId: string,
    afterCursor: string,
  ): Promise<void> {
    const events = await this.eventRepository
      .createQueryBuilder('event')
      .where('event.escrowId = :escrowId', { escrowId })
      .andWhere('event.cursor > :afterCursor', { afterCursor })
      .orderBy('event.cursor', 'ASC')
      .take(100)
      .getMany();
    client.emit('events.missed', { escrowId, events });
    for (const event of events) this.emitEscrowEventToClient(client, event);
  }

  private emitEscrowEventToClient(client: Socket, event: EscrowEvent): void {
    const base = {
      escrowId: event.escrowId,
      eventId: event.id,
      cursor: event.cursor,
      eventType: event.eventType,
      actorId: event.actorId,
      data: event.data,
      timestamp: event.createdAt,
    };
    client.emit('escrow.event', base);
    const specificEvent = this.eventName(event.eventType);
    if (specificEvent) client.emit(specificEvent, base);
    const status = this.statusForEvent(event);
    if (status) client.emit('escrow.status_changed', { ...base, status });
  }

  private eventName(type: string): string | undefined {
    const names: Record<string, string> = {
      condition_fulfilled: 'escrow.condition_fulfilled',
      condition_met: 'escrow.condition_confirmed',
      dispute_filed: 'escrow.dispute_filed',
      disputed: 'escrow.dispute_filed',
      dispute_resolved: 'escrow.dispute_resolved',
      funded: 'escrow.funded',
      completed: 'escrow.completed',
      cancelled: 'escrow.cancelled',
      milestone_released: 'escrow.milestone_released',
      party_accepted: 'escrow.party_joined',
    };
    return names[type];
  }

  private statusForEvent(event: EscrowEvent): string | undefined {
    const statuses: Record<string, string> = {
      funded: 'active',
      completed: 'completed',
      cancelled: 'cancelled',
      disputed: 'disputed',
      dispute_filed: 'disputed',
      expired: 'expired',
    };
    return (
      (typeof event.data?.nextEscrowStatus === 'string'
        ? event.data.nextEscrowStatus
        : undefined) || statuses[event.eventType]
    );
  }

  private getSocketUserId(client: Socket): string | undefined {
    const userId = (client.data as { userId?: unknown }).userId;
    return typeof userId === 'string' ? userId : undefined;
  }

  private escrowRoom(escrowId: string): string {
    return `escrow:${escrowId}`;
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }
}
