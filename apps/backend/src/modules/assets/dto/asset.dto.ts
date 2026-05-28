import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsBoolean,
  Length,
} from 'class-validator';

export class CreateAssetDto {
  @ApiProperty({ description: 'Asset code (e.g. XLM, USDC)', example: 'USDC' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 12)
  code: string;

  @ApiPropertyOptional({ description: 'Issuer public key for non-native assets', example: 'GBBD...' })
  @IsString()
  @IsOptional()
  @Length(56, 56)
  issuer?: string;

  @ApiProperty({ description: 'Human-readable display name', example: 'USDC Coin' })
  @IsString()
  @IsNotEmpty()
  displayName: string;

  @ApiPropertyOptional({ description: 'URL for asset icon', example: 'https://example.com/icon.png' })
  @IsString()
  @IsOptional()
  iconUrl?: string;

  @ApiPropertyOptional({ description: 'Number of decimal places', example: 7 })
  @IsInt()
  @Min(0)
  @Max(18)
  @IsOptional()
  decimals?: number;

  @ApiPropertyOptional({ description: 'Whether the asset is currently active', example: true })
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}

export class UpdateAssetDto {
  @ApiPropertyOptional({ description: 'Asset code', example: 'USDC' })
  @IsString()
  @IsOptional()
  @Length(1, 12)
  code?: string;

  @ApiPropertyOptional({ description: 'Issuer public key', example: 'GBBD...' })
  @IsString()
  @IsOptional()
  @Length(56, 56)
  issuer?: string;

  @ApiPropertyOptional({ description: 'Human-readable display name', example: 'USDC Coin' })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiPropertyOptional({ description: 'URL for asset icon', example: 'https://example.com/icon.png' })
  @IsString()
  @IsOptional()
  iconUrl?: string;

  @ApiPropertyOptional({ description: 'Number of decimal places', example: 7 })
  @IsInt()
  @Min(0)
  @Max(18)
  @IsOptional()
  decimals?: number;

  @ApiPropertyOptional({ description: 'Whether the asset is currently active', example: true })
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
