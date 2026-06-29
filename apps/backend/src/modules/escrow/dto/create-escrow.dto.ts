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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EscrowType } from '../entities/escrow.entity';
import { PartyRole } from '../entities/party.entity';
import { ConditionType } from '../entities/condition.entity';

export class EscrowAssetDto {
  @ApiProperty({ description: 'Asset code to escrow', example: 'XLM' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Issuer for non-native assets', example: 'GA...' })
  @ValidateIf((o: EscrowAssetDto) => o.code !== 'XLM')
  @IsString()
  @IsNotEmpty()
  issuer: string;
}

export class CreatePartyDto {
  @ApiProperty({ description: 'User identifier for the party', example: 'user_123' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ enum: PartyRole, description: 'Role of the party in the escrow' })
  @IsEnum(PartyRole)
  role: PartyRole;
}

export class CreateConditionDto {
  @ApiProperty({ description: 'Condition description', example: 'Deliver the signed contract' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description: string;

  @ApiPropertyOptional({ enum: ConditionType, description: 'Condition type' })
  @IsEnum(ConditionType)
  @IsOptional()
  type?: ConditionType;

  @ApiPropertyOptional({ description: 'Arbitrary metadata for the condition' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class CreateEscrowDto {
  @ApiProperty({ description: 'Escrow title', example: 'Website redesign' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ description: 'Escrow description', example: 'Create a new landing page' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ description: 'Escrow amount in the selected asset', example: 1000 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ type: EscrowAssetDto, description: 'Asset used for the escrow' })
  @IsOptional()
  @ValidateNested()
  @Type(() => EscrowAssetDto)
  asset?: EscrowAssetDto;

  @ApiPropertyOptional({ enum: EscrowType, description: 'Escrow type' })
  @IsEnum(EscrowType)
  @IsOptional()
  type?: EscrowType;

  @ApiProperty({ type: [CreatePartyDto], description: 'Parties participating in the escrow' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePartyDto)
  parties: CreatePartyDto[];

  @ApiPropertyOptional({ type: [CreateConditionDto], description: 'Conditions attached to the escrow' })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateConditionDto)
  conditions?: CreateConditionDto[];

  @ApiPropertyOptional({ description: 'Optional expiry date for the escrow', example: '2026-12-31T23:59:59.000Z' })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'Optional metadata hash', example: 'ipfs://abc123' })
  @IsString()
  @IsOptional()
  metadataHash?: string;
}
