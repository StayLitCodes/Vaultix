// DTOs and types for the Consistency Checker feature

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConsistencyCheckRequest {
  @ApiPropertyOptional({
    description: 'Array of specific Escrow IDs to check',
    example: [1, 2, 3],
  })
  escrowIds?: number[];

  @ApiPropertyOptional({
    description: 'Starting Escrow ID for a range check',
    example: 1,
  })
  fromId?: number;

  @ApiPropertyOptional({
    description: 'Ending Escrow ID for a range check',
    example: 100,
  })
  toId?: number;
}

export class FieldMismatch {
  @ApiProperty({ description: 'The name of the mismatched field', example: 'amount' })
  fieldName: string;

  @ApiProperty({ description: 'Value found in the database', example: '100' })
  dbValue: unknown;

  @ApiProperty({ description: 'Value found on-chain', example: '150' })
  onchainValue: unknown;
}

export class EscrowDiffReport {
  @ApiProperty({ description: 'The ID of the escrow', example: 1 })
  escrowId: number;

  @ApiProperty({ description: 'Whether the database matches the chain', example: false })
  isConsistent: boolean;

  @ApiProperty({ description: 'List of mismatched fields', type: [FieldMismatch] })
  fieldsMismatched: FieldMismatch[];

  @ApiPropertyOptional({ description: 'True if record is missing in DB', example: false })
  missingInDb?: boolean;

  @ApiPropertyOptional({ description: 'True if record is missing on-chain', example: true })
  missingOnChain?: boolean;

  @ApiPropertyOptional({ description: 'Error message if the check failed', example: 'Node timeout' })
  error?: string;
}

export class ConsistencySummary {
  @ApiProperty({ description: 'Total escrows checked', example: 100 })
  totalChecked: number;

  @ApiProperty({ description: 'Total escrows with mismatched data', example: 5 })
  totalInconsistent: number;

  @ApiProperty({ description: 'Total escrows missing from database', example: 1 })
  totalMissingInDb: number;

  @ApiProperty({ description: 'Total escrows missing from blockchain', example: 0 })
  totalMissingOnChain: number;

  @ApiProperty({ description: 'Total checks that resulted in an error', example: 2 })
  totalErrored: number;
}

export class ConsistencyCheckResponse {
  @ApiProperty({ description: 'Detailed reports for each checked escrow', type: [EscrowDiffReport] })
  reports: EscrowDiffReport[];

  @ApiProperty({ description: 'Summary statistics of the consistency check', type: ConsistencySummary })
  summary: ConsistencySummary;
}
