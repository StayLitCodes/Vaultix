import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsArray,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { DisputeOutcome } from '../entities/dispute.entity';

export class FileDisputeDto {
  @ApiProperty({ description: 'Reason for filing the dispute', example: 'Item not received' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;

  /**
   * Optional list of evidence URLs or reference strings (e.g. IPFS CIDs,
   * cloud storage links, transaction hashes).
   */
  @ApiPropertyOptional({
    description: 'List of evidence URLs or CIDs',
    example: ['ipfs://Qm...', 'https://example.com/evidence.jpg'],
    type: [String],
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  evidence?: string[];
}

export class ResolveDisputeDto {
  @ApiProperty({ description: 'Outcome of the dispute', enum: DisputeOutcome, example: DisputeOutcome.REFUND_BUYER })
  @IsEnum(DisputeOutcome)
  outcome: DisputeOutcome;

  @ApiProperty({ description: 'Notes on why the resolution was made', example: 'Evidence confirms buyer claim' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  resolutionNotes: string;

  /**
   * Percentage of funds to release to the seller (0-100).
   * Required when outcome is SPLIT; sellerPercent + buyerPercent must equal 100.
   */
  @ApiPropertyOptional({ description: 'Percentage of funds to release to seller (0-100)', example: 50 })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  sellerPercent?: number;

  /**
   * Percentage of funds to refund to the buyer (0-100).
   * Required when outcome is SPLIT; sellerPercent + buyerPercent must equal 100.
   */
  @ApiPropertyOptional({ description: 'Percentage of funds to refund to buyer (0-100)', example: 50 })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  buyerPercent?: number;
}
