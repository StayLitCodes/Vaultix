import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  EscrowEventStore,
  EscrowEventStoreType,
} from '../entities/escrow-event-store.entity';
import {
  AppendEventDto,
  EventStoreQueryDto,
  EventStoreResponseDto,
  ReplayEventResponseDto,
  TimelineItemDto,
  TimelineResponseDto,
} from '../dto/event-store.dto';
import { EscrowService } from './escrow.service';

const EVENT_SUMMARIES: Record<EscrowEventStoreType, string> = {
  [EscrowEventStoreType.CREATED]: 'Escrow was created',
  [EscrowEventStoreType.FUNDED]: 'Escrow was funded',
  [EscrowEventStoreType.CONDITION_FULFILLED]: 'A condition was fulfilled',
  [EscrowEventStoreType.CONDITION_CONFIRMED]: 'A condition was confirmed',
  [EscrowEventStoreType.MILESTONE_RELEASED]: 'A milestone was released',
  [EscrowEventStoreType.PARTY_INVITED]: 'A party was invited',
  [EscrowEventStoreType.PARTY_ACCEPTED]: 'A party accepted the invitation',
  [EscrowEventStoreType.PARTY_REJECTED]: 'A party rejected the invitation',
  [EscrowEventStoreType.DISPUTE_FILED]: 'A dispute was filed',
  [EscrowEventStoreType.DISPUTE_RESOLVED]: 'The dispute was resolved',
  [EscrowEventStoreType.RELEASED]: 'Escrow funds were released',
  [EscrowEventStoreType.CANCELLED]: 'Escrow was cancelled',
  [EscrowEventStoreType.EXPIRED]: 'Escrow expired',
  [EscrowEventStoreType.REFUND_PROCESSED]: 'Refund was processed',
  [EscrowEventStoreType.EXPIRATION_WARNING]: 'Expiration warning was sent',
};

@Injectable()
export class EscrowEventStoreService {
  private readonly logger = new Logger(EscrowEventStoreService.name);

  constructor(
    @InjectRepository(EscrowEventStore)
    private readonly eventStoreRepository: Repository<EscrowEventStore>,
    private readonly escrowService: EscrowService,
  ) {}

  async append(dto: AppendEventDto): Promise<EscrowEventStore> {
    if (dto.idempotencyKey) {
      const existing = await this.eventStoreRepository.findOne({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        this.logger.warn(
          `Duplicate event with idempotencyKey ${dto.idempotencyKey} blocked`,
        );
        return existing;
      }
    }

    const lastEvent = await this.eventStoreRepository.findOne({
      where: {},
      order: { cursor: 'DESC' },
    });
    const lastCursor = lastEvent?.cursor ? BigInt(lastEvent.cursor) : BigInt(0);
    const nextCursor = (lastCursor + BigInt(1)).toString();

    const event = this.eventStoreRepository.create({
      escrowId: dto.escrowId,
      eventType: dto.eventType,
      actorId: dto.actorId,
      payload: dto.payload ?? {},
      txHash: dto.txHash,
      ipAddress: dto.ipAddress,
      idempotencyKey: dto.idempotencyKey ?? uuidv4(),
      eventVersion: 1,
      cursor: nextCursor,
    });

    return this.eventStoreRepository.save(event);
  }

  async query(
    queryDto: EventStoreQueryDto,
    escrowId?: string,
  ): Promise<{
    data: EventStoreResponseDto[];
    total: number;
    page: number;
    limit: number;
    nextCursor?: string;
    prevCursor?: string;
  }> {
    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.eventStoreRepository.createQueryBuilder('event');

    if (escrowId) {
      qb.andWhere('event.escrowId = :escrowId', { escrowId });
    }

    if (queryDto.eventType) {
      qb.andWhere('event.eventType = :eventType', {
        eventType: queryDto.eventType,
      });
    }

    if (queryDto.actorId) {
      qb.andWhere('event.actorId = :actorId', { actorId: queryDto.actorId });
    }

    if (queryDto.dateFrom) {
      qb.andWhere('event.createdAt >= :dateFrom', {
        dateFrom: new Date(queryDto.dateFrom),
      });
    }

    if (queryDto.dateTo) {
      qb.andWhere('event.createdAt <= :dateTo', {
        dateTo: new Date(queryDto.dateTo),
      });
    }

    if (queryDto.after) {
      qb.andWhere('event.cursor > :after', { after: queryDto.after });
    }

    if (queryDto.before) {
      qb.andWhere('event.cursor < :before', { before: queryDto.before });
    }

    qb.orderBy('event.cursor', 'ASC');

    const [events, total] = await qb.skip(skip).take(limit).getManyAndCount();

    let nextCursor: string | undefined;
    let prevCursor: string | undefined;

    if (events.length > 0) {
      const lastCursor = events[events.length - 1].cursor;
      const firstCursor = events[0].cursor;

      const nextEvents = await this.eventStoreRepository.count({
        where: { cursor: MoreThan(lastCursor) },
      });
      if (nextEvents > 0) {
        nextCursor = lastCursor;
      }

      const prevEvents = await this.eventStoreRepository.count({
        where: { cursor: LessThan(firstCursor) },
      });
      if (prevEvents > 0) {
        prevCursor = firstCursor;
      }
    }

    const data: EventStoreResponseDto[] = events.map((event) => ({
      id: event.id,
      escrowId: event.escrowId,
      eventType: event.eventType,
      actorId: event.actorId,
      payload: event.payload,
      txHash: event.txHash,
      idempotencyKey: event.idempotencyKey,
      eventVersion: event.eventVersion,
      createdAt: event.createdAt,
      cursor: event.cursor,
    }));

    return { data, total, page, limit, nextCursor, prevCursor };
  }

  async getTimeline(escrowId: string): Promise<TimelineResponseDto> {
    const events = await this.eventStoreRepository.find({
      where: { escrowId },
      order: { cursor: 'ASC' },
    });

    const timeline: TimelineItemDto[] = events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      actorId: event.actorId,
      summary: this.buildSummary(event),
      timestamp: event.createdAt,
    }));

    return { escrowId, timeline };
  }

  async replayAndCheck(
    escrowId: string,
  ): Promise<ReplayEventResponseDto> {
    const events = await this.eventStoreRepository.find({
      where: { escrowId },
      order: { cursor: 'ASC' },
    });

    const reconstructedState: Record<string, any> = {
      status: null,
      isFunded: false,
      isReleased: false,
      conditionsFulfilled: 0,
      conditionsConfirmed: 0,
      disputesFiled: 0,
      totalEvents: events.length,
    };

    for (const event of events) {
      switch (event.eventType) {
        case EscrowEventStoreType.CREATED:
          reconstructedState.status = 'PENDING';
          break;
        case EscrowEventStoreType.FUNDED:
          reconstructedState.isFunded = true;
          reconstructedState.status = 'ACTIVE';
          break;
        case EscrowEventStoreType.CONDITION_FULFILLED:
          reconstructedState.conditionsFulfilled++;
          break;
        case EscrowEventStoreType.CONDITION_CONFIRMED:
          reconstructedState.conditionsConfirmed++;
          break;
        case EscrowEventStoreType.RELEASED:
          reconstructedState.isReleased = true;
          reconstructedState.status = 'COMPLETED';
          break;
        case EscrowEventStoreType.CANCELLED:
          reconstructedState.status = 'CANCELLED';
          break;
        case EscrowEventStoreType.DISPUTE_FILED:
          reconstructedState.disputesFiled++;
          reconstructedState.status = 'DISPUTED';
          break;
        case EscrowEventStoreType.DISPUTE_RESOLVED:
          if (event.payload?.nextEscrowStatus === 'cancelled') {
            reconstructedState.status = 'CANCELLED';
          } else {
            reconstructedState.status = 'COMPLETED';
          }
          break;
        case EscrowEventStoreType.EXPIRED:
          reconstructedState.status = 'EXPIRED';
          break;
        case EscrowEventStoreType.REFUND_PROCESSED:
          reconstructedState.isRefunded = true;
          reconstructedState.status = 'REFUNDED';
          break;
      }
    }

    let isConsistent = true;
    const inconsistencies: string[] = [];

    try {
      const currentEscrow =
        await this.escrowService.findOne(escrowId);
      const dbStatus = currentEscrow.status?.toUpperCase();

      if (
        reconstructedState.status &&
        reconstructedState.status !== dbStatus
      ) {
        isConsistent = false;
        inconsistencies.push(
          `Status mismatch: reconstructed=${reconstructedState.status}, db=${dbStatus}`,
        );
      }
    } catch {
      inconsistencies.push('Escrow not found in database');
      isConsistent = false;
    }

    return {
      escrowId,
      totalEventsReplayed: events.length,
      reconstructedState,
      isConsistent,
      inconsistencies: inconsistencies.length > 0 ? inconsistencies : undefined,
    };
  }

  private buildSummary(event: EscrowEventStore): string {
    const base = EVENT_SUMMARIES[event.eventType] ?? event.eventType;
    if (event.payload) {
      const details = Object.entries(event.payload)
        .filter(([key]) => key !== 'dto' && key !== 'changes')
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join(', ');
      if (details) {
        return `${base} (${details})`;
      }
    }
    return base;
  }

  async existsByIdempotencyKey(key: string): Promise<boolean> {
    const count = await this.eventStoreRepository.count({
      where: { idempotencyKey: key },
    });
    return count > 0;
  }
}
