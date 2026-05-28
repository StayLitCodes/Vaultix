import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({ description: 'Asset code (e.g. XLM, USDC)', example: 'USDC' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ description: 'Issuer public key for non-native assets', example: 'GBBD47IF6LWK7P7MDEVSCWT7VN4VNMTROWW5NDJTNNLEQQQAWQY3L4B' })
  @ValidateIf((o: EscrowAssetDto) => o.code !== 'XLM')
  @IsString()
  @IsNotEmpty()
  issuer: string;
}

export class CreatePartyDto {
  @ApiProperty({ description: 'Wallet address of the party', example: 'GBBD47IF6LWK7P7MDEVSCWT7VN4VNMTROWW5NDJTNNLEQQQAWQY3L4B' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Role of the party in the escrow', enum: PartyRole, example: PartyRole.BUYER })
  @IsEnum(PartyRole)
  role: PartyRole;
}

export class CreateConditionDto {
  @ApiProperty({ description: 'Description of the condition', example: 'Delivery of physical goods to address X' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description: string;

  @ApiPropertyOptional({ description: 'Type of condition', enum: ConditionType, example: ConditionType.MANUAL })
  @IsEnum(ConditionType)
  @IsOptional()
  type?: ConditionType;

  @ApiPropertyOptional({ description: 'Additional metadata for the condition', example: { trackingRequired: true } })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class CreateEscrowDto {
  @ApiProperty({ description: 'Title of the escrow', example: 'Purchase of laptop' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ description: 'Detailed description of the escrow agreement', example: 'Buying a used MacBook Pro' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ description: 'Amount to be held in escrow', example: 500.5 })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ description: 'Asset details. Defaults to XLM if omitted.', type: () => EscrowAssetDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EscrowAssetDto)
  asset?: EscrowAssetDto;

  @ApiPropertyOptional({ description: 'Type of escrow', enum: EscrowType, example: EscrowType.STANDARD })
  @IsEnum(EscrowType)
  @IsOptional()
  type?: EscrowType;

  @ApiProperty({ description: 'Parties involved in the escrow', type: () => [CreatePartyDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePartyDto)
  parties: CreatePartyDto[];

  @ApiPropertyOptional({ description: 'Conditions for releasing funds', type: () => [CreateConditionDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateConditionDto)
  conditions?: CreateConditionDto[];

  @ApiPropertyOptional({ description: 'ISO string date when escrow expires', example: '2026-12-31T23:59:59Z' })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'IPFS hash or other metadata hash', example: 'Qm...' })
  @IsString()
  @IsOptional()
  metadataHash?: string;
}
