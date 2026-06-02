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
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;

  /**
   * Optional list of evidence URLs or reference strings (e.g. IPFS CIDs,
   * cloud storage links, transaction hashes).
   */
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  evidence?: string[];
}

export class ResolveDisputeDto {
  @IsEnum(DisputeOutcome)
  outcome: DisputeOutcome;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  resolutionNotes: string;

  /**
   * Percentage of funds to release to the seller (0-100).
   * Required when outcome is SPLIT; sellerPercent + buyerPercent must equal 100.
   */
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  sellerPercent?: number;

  /**
   * Percentage of funds to refund to the buyer (0-100).
   * Required when outcome is SPLIT; sellerPercent + buyerPercent must equal 100.
   */
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  buyerPercent?: number;
}
