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
  @IsString()
  @IsNotEmpty()
  @Length(1, 12)
  code: string;

  @IsString()
  @IsOptional()
  @Length(56, 56)
  issuer?: string;

  @IsString()
  @IsNotEmpty()
  displayName: string;

  @IsString()
  @IsOptional()
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
  @IsOptional()
  @Length(1, 12)
  code?: string;

  @IsString()
  @IsOptional()
  @Length(56, 56)
  issuer?: string;

  @IsString()
  @IsOptional()
  displayName?: string;

  @IsString()
  @IsOptional()
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
