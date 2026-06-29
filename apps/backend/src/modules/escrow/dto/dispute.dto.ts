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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DisputeOutcome } from '../entities/dispute.entity';

export class FileDisputeDto {
  @ApiProperty({ description: 'Reason for filing the dispute', example: 'The work was not delivered on time' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;

  /**
   * Optional list of evidence URLs or reference strings (e.g. IPFS CIDs,
   * cloud storage links, transaction hashes).
   */
  @ApiPropertyOptional({ description: 'Optional evidence references for the dispute', example: ['ipfs://abc123'] })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  evidence?: string[];
}

export class ResolveDisputeDto {
  @ApiProperty({ enum: DisputeOutcome, description: 'Resolution outcome for the dispute' })
  @IsEnum(DisputeOutcome)
  outcome: DisputeOutcome;

  @ApiProperty({ description: 'Notes explaining the dispute resolution', example: 'The buyer was refunded' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  resolutionNotes: string;

  /**
   * Percentage of funds to release to the seller (0-100).
   * Required when outcome is SPLIT; sellerPercent + buyerPercent must equal 100.
   */
  @ApiPropertyOptional({ description: 'Percentage of funds released to the seller', example: 50 })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  sellerPercent?: number;

  /**
   * Percentage of funds to refund to the buyer (0-100).
   * Required when outcome is SPLIT; sellerPercent + buyerPercent must equal 100.
   */
  @ApiPropertyOptional({ description: 'Percentage of funds refunded to the buyer', example: 50 })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  buyerPercent?: number;
}
