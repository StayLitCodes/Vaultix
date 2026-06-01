import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsDateString,
  IsUUID,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EscrowEventStoreType } from '../entities/escrow-event-store.entity';

export class AppendEventDto {
  @IsUUID()
  escrowId: string;

  @IsEnum(EscrowEventStoreType)
  eventType: EscrowEventStoreType;

  @IsString()
  @IsOptional()
  actorId?: string;

  @IsObject()
  @IsOptional()
  payload?: Record<string, any>;

  @IsString()
  @IsOptional()
  txHash?: string;

  @IsString()
  @IsOptional()
  ipAddress?: string;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}

export class EventStoreQueryDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;

  @IsEnum(EscrowEventStoreType)
  @IsOptional()
  eventType?: EscrowEventStoreType;

  @IsString()
  @IsOptional()
  actorId?: string;

  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @IsString()
  @IsOptional()
  after?: string;

  @IsString()
  @IsOptional()
  before?: string;
}

export class EventStoreResponseDto {
  id: string;
  escrowId: string;
  eventType: EscrowEventStoreType;
  actorId?: string;
  payload?: Record<string, any>;
  txHash?: string;
  idempotencyKey?: string;
  eventVersion: number;
  createdAt: Date;
  cursor: string;
}

export class ReplayEventResponseDto {
  escrowId: string;
  totalEventsReplayed: number;
  reconstructedState: Record<string, any>;
  isConsistent: boolean;
  inconsistencies?: string[];
}

export class TimelineItemDto {
  id: string;
  eventType: EscrowEventStoreType;
  actorId?: string;
  summary: string;
  timestamp: Date;
}

export class TimelineResponseDto {
  escrowId: string;
  timeline: TimelineItemDto[];
}
