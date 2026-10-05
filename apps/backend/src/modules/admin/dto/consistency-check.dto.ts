import { IsArray, IsString, Matches, MaxLength } from 'class-validator';

export class ConsistencyCheckByIdsDto {
  @IsArray()
  @IsString({ each: true })
  @MaxLength(36, { each: true })
  @Matches(
    /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|0|[1-9][0-9]{0,19})$/i,
    { each: true },
  )
  escrowIds: string[];
}

export class ConsistencyCheckByRangeDto {
  @IsString()
  @Matches(/^[1-9][0-9]{0,19}$/)
  fromId: string;

  @IsString()
  @Matches(/^[1-9][0-9]{0,19}$/)
  toId: string;
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
  escrowId: string;
  isConsistent: boolean;
  fieldsMismatched: FieldMismatch[];
  missingInDb?: boolean;
  missingOnChain?: boolean;
  error?: string;
  unmappedHistorical?: boolean;
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
