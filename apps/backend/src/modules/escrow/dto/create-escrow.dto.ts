import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsPositive,
  IsEnum,
  IsArray,
  ValidateNested,
  IsDateString,
  MaxLength,
  ArrayMinSize,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EscrowType } from '../entities/escrow.entity';
import { PartyRole } from '../entities/party.entity';
import { ConditionType } from '../entities/condition.entity';

export class EscrowAssetDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @ValidateIf((o: EscrowAssetDto) => o.code !== 'XLM')
  @IsString()
  @IsNotEmpty()
  issuer: string;
}

export class CreatePartyDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsEnum(PartyRole)
  role: PartyRole;
}

export class CreateConditionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description: string;

  @IsEnum(ConditionType)
  @IsOptional()
  type?: ConditionType;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class CreateEscrowDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => EscrowAssetDto)
  asset?: EscrowAssetDto;

  @IsEnum(EscrowType)
  @IsOptional()
  type?: EscrowType;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePartyDto)
  parties: CreatePartyDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateConditionDto)
  conditions?: CreateConditionDto[];

  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @IsString()
  @IsOptional()
  metadataHash?: string;
}
