import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum EscrowOverviewRole {
  DEPOSITOR = 'depositor',
  RECIPIENT = 'recipient',
  ANY = 'any',
}

export enum EscrowOverviewStatus {
  CREATED = 'created',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  DISPUTED = 'disputed',
  EXPIRED = 'expired',
  PENDING = 'pending',
}

export enum EscrowOverviewSortBy {
  CREATED_AT = 'createdAt',
  DEADLINE = 'deadline',
}

export enum EscrowOverviewSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class EscrowOverviewQueryDto {
  @ApiPropertyOptional({ enum: EscrowOverviewRole, default: EscrowOverviewRole.ANY })
  @IsEnum(EscrowOverviewRole)
  @IsOptional()
  role?: EscrowOverviewRole = EscrowOverviewRole.ANY;

  @ApiPropertyOptional({ enum: EscrowOverviewStatus })
  @IsEnum(EscrowOverviewStatus)
  @IsOptional()
  status?: EscrowOverviewStatus;

  @ApiPropertyOptional({ description: 'Asset/token identifier', example: 'XLM' })
  @IsString()
  @IsOptional()
  token?: string;

  @ApiPropertyOptional({ description: 'Filter from created date (inclusive)', example: '2026-01-01T00:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ description: 'Filter to created date (inclusive)', example: '2026-12-31T23:59:59.999Z' })
  @IsDateString()
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number = 20;

  @ApiPropertyOptional({ enum: EscrowOverviewSortBy, default: EscrowOverviewSortBy.CREATED_AT })
  @IsEnum(EscrowOverviewSortBy)
  @IsOptional()
  sortBy?: EscrowOverviewSortBy = EscrowOverviewSortBy.CREATED_AT;

  @ApiPropertyOptional({ enum: EscrowOverviewSortOrder, default: EscrowOverviewSortOrder.DESC })
  @IsEnum(EscrowOverviewSortOrder)
  @IsOptional()
  sortOrder?: EscrowOverviewSortOrder = EscrowOverviewSortOrder.DESC;
}

export class EscrowOverviewItemDto {
  @ApiProperty()
  escrowId: string;

  @ApiProperty()
  depositor: string;

  @ApiProperty({ nullable: true })
  recipient: string | null;

  @ApiProperty()
  token: string;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  totalReleased: number;

  @ApiProperty()
  remainingAmount: number;

  @ApiProperty()
  status: string;

  @ApiProperty({ nullable: true })
  deadline: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class EscrowOverviewResponseDto {
  @ApiProperty({ type: [EscrowOverviewItemDto] })
  data: EscrowOverviewItemDto[];

  @ApiProperty()
  totalItems: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}
