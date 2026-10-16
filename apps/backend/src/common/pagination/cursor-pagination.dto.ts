import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum CursorSortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

/** Shared query params for cursor-paginated list endpoints. */
export class CursorPaginationDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  cursor?: string;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @IsEnum(CursorSortOrder)
  @IsOptional()
  sortOrder?: CursorSortOrder = CursorSortOrder.DESC;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}
