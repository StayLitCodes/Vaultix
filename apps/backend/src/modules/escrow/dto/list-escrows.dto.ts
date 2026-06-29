import { IsString, IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EscrowStatus, EscrowType } from '../entities/escrow.entity';
import { PartyRole } from '../entities/party.entity';

export enum SortBy {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  AMOUNT = 'amount',
  TITLE = 'title',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListEscrowsDto {
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

  @ApiPropertyOptional({ enum: EscrowStatus, description: 'Filter escrows by status' })
  @IsEnum(EscrowStatus)
  @IsOptional()
  status?: EscrowStatus;

  @ApiPropertyOptional({ enum: EscrowType, description: 'Filter escrows by type' })
  @IsEnum(EscrowType)
  @IsOptional()
  type?: EscrowType;

  @ApiPropertyOptional({ enum: PartyRole, description: 'Filter escrows by the current user role' })
  @IsEnum(PartyRole)
  @IsOptional()
  role?: PartyRole;

  @ApiPropertyOptional({ enum: SortBy, description: 'Field used to sort escrow results' })
  @IsEnum(SortBy)
  @IsOptional()
  sortBy?: SortBy = SortBy.CREATED_AT;

  @ApiPropertyOptional({ enum: SortOrder, description: 'Sort direction for escrow results' })
  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({ description: 'Full-text search across escrow titles and descriptions', example: 'design' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter escrows by asset code', example: 'XLM' })
  @IsString()
  @IsOptional()
  assetCode?: string;

  @ApiPropertyOptional({ description: 'Filter escrows by asset issuer', example: 'GA...' })
  @IsString()
  @IsOptional()
  assetIssuer?: string;
}
