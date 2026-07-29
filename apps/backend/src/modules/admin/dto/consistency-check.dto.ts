import { IsArray, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ConsistencyCheckByIdsDto {
  @IsArray()
  @IsNumber({}, { each: true })
  @Min(1, { each: true })
  @Type(() => Number)
  escrowIds: number[];
}

export class ConsistencyCheckByRangeDto {
  @IsNumber()
  @Min(1)
  fromId: number;

  @IsNumber()
  @Min(1)
  toId: number;
}

// Union type for request validation
export type ConsistencyCheckRequest =
  | ConsistencyCheckByIdsDto
  | ConsistencyCheckByRangeDto;

export interface FieldMismatch {
  fieldName: string;
  dbValue: unknown;
  onchainValue: unknown;
}

export interface EscrowDiffReport {
  escrowId: number;
  isConsistent: boolean;
  fieldsMismatched: FieldMismatch[];
  missingInDb?: boolean;
  missingOnChain?: boolean;
  error?: string;
}

export interface ConsistencyCheckResponse {
  reports: EscrowDiffReport[];
  summary: {
    totalChecked: number;
    totalInconsistent: number;
    totalMissingInDb: number;
    totalMissingOnChain: number;
    totalErrored: number;
  };
}
