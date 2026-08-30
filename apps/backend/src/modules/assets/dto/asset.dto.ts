import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsBoolean,
  Length,
  MaxLength,
} from 'class-validator';
import { IsStellarAddress } from '../../../utils/validators';

export class CreateAssetDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 12)
  code: string;

  @IsStellarAddress()
  @IsOptional()
  issuer?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  displayName: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @MaxLength(500)
  iconUrl?: string;

  @IsInt()
  @Min(0)
  @Max(18)
  @IsOptional()
  decimals?: number;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}

export class UpdateAssetDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @Length(1, 12)
  code?: string;

  @IsStellarAddress()
  @IsOptional()
  issuer?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @MaxLength(255)
  displayName?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @MaxLength(500)
  iconUrl?: string;

  @IsInt()
  @Min(0)
  @Max(18)
  @IsOptional()
  decimals?: number;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
