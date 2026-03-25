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
import { EscrowEventType } from '../entities/escrow-event.entity';

export enum EventSortBy {
  CREATED_AT = 'createdAt',
  EVENT_TYPE = 'eventType',
}

export enum EventSortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListEventsDto {
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

  @IsEnum(EscrowEventType)
  @IsOptional()
  eventType?: EscrowEventType;

  @IsString()
  @IsOptional()
  actorId?: string;

  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @IsEnum(EventSortBy)
  @IsOptional()
  sortBy?: EventSortBy = EventSortBy.CREATED_AT;

  @IsUUID()
  @IsOptional()
  escrowId?: string;

  @IsEnum(EventSortOrder)
  @IsOptional()
  sortOrder?: EventSortOrder = EventSortOrder.DESC;
}
