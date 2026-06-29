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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAssetDto {
  @ApiProperty({ description: 'Asset code that identifies the asset', example: 'USDC' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 12)
  code: string;

  @ApiPropertyOptional({ description: 'Issuer account for non-native assets', example: 'GA...' })
  @IsString()
  @IsOptional()
  @Length(56, 56)
  issuer?: string;

  @ApiProperty({ description: 'Human-readable asset name', example: 'USD Coin' })
  @IsString()
  @IsNotEmpty()
  displayName: string;

  @ApiPropertyOptional({ description: 'URL to the asset icon', example: 'https://example.com/usdc.png' })
  @IsString()
  @IsOptional()
  iconUrl?: string;

  @ApiPropertyOptional({ description: 'Number of decimal places for the asset', example: 7 })
  @IsInt()
  @Min(0)
  @Max(18)
  @IsOptional()
  decimals?: number;

  @ApiPropertyOptional({ description: 'Whether the asset is active', example: true })
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}

export class UpdateAssetDto {
  @ApiPropertyOptional({ description: 'Asset code that identifies the asset', example: 'USDC' })
  @IsString()
  @IsOptional()
  @Length(1, 12)
  code?: string;

  @ApiPropertyOptional({ description: 'Issuer account for non-native assets', example: 'GA...' })
  @IsString()
  @IsOptional()
  @Length(56, 56)
  issuer?: string;

  @ApiPropertyOptional({ description: 'Human-readable asset name', example: 'USD Coin' })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiPropertyOptional({ description: 'URL to the asset icon', example: 'https://example.com/usdc.png' })
  @IsString()
  @IsOptional()
  iconUrl?: string;

  @ApiPropertyOptional({ description: 'Number of decimal places for the asset', example: 7 })
  @IsInt()
  @Min(0)
  @Max(18)
  @IsOptional()
  decimals?: number;

  @ApiPropertyOptional({ description: 'Whether the asset is active', example: true })
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
