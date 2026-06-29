import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsDateString,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EscrowEventType } from '../entities/escrow-event.entity';

export enum EventSortBy {
  CREATED_AT = 'createdAt',
  EVENT_TYPE = 'eventType',
  CURSOR = 'cursor',
}

export enum EventSortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListEventsDto {
  @ApiPropertyOptional({ description: 'Page number for pagination', example: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size for pagination', example: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({ enum: EscrowEventType, description: 'Filter events by type' })
  @IsEnum(EscrowEventType)
  @IsOptional()
  eventType?: EscrowEventType;

  @ApiPropertyOptional({ description: 'Filter events by actor ID', example: 'user_123' })
  @IsString()
  @IsOptional()
  actorId?: string;

  @ApiPropertyOptional({ description: 'Start date for event filtering', example: '2026-01-01T00:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'End date for event filtering', example: '2026-01-31T23:59:59.000Z' })
  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @ApiPropertyOptional({ enum: EventSortBy, description: 'Sort field for event results' })
  @IsEnum(EventSortBy)
  @IsOptional()
  sortBy?: EventSortBy = EventSortBy.CREATED_AT;

  @ApiPropertyOptional({ description: 'Filter events for a specific escrow', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID()
  @IsOptional()
  escrowId?: string;

  @ApiPropertyOptional({ enum: EventSortOrder, description: 'Sort direction for event results' })
  @IsEnum(EventSortOrder)
  @IsOptional()
  sortOrder?: EventSortOrder = EventSortOrder.DESC;

  // Cursor-based pagination for incremental sync
  @IsString()
  @IsOptional()
  cursor?: string;

  // When using cursor, fetch events after this cursor
  @IsString()
  @IsOptional()
  after?: string;

  // When using cursor, fetch events before this cursor
  @IsString()
  @IsOptional()
  before?: string;
}
