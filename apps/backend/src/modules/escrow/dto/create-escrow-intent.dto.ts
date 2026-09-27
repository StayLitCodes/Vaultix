import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreationMilestoneDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description: string;

  @IsString()
  @Matches(/^(?=.*[1-9])(?:0|[1-9]\d*)(?:\.\d{1,7})?$/)
  amount: string;
}

export class CreationConditionDto {
  @IsString()
  @IsIn(['manual', 'time', 'oracle'])
  type: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsDateString()
  @IsOptional()
  releaseDate?: string;
}

export class PrepareEscrowCreationDto {
  @IsUUID('4')
  intentId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @MaxLength(2000)
  description: string;

  @IsString()
  @IsIn(['service', 'goods', 'milestone', 'other'])
  category: string;

  @IsString()
  @Matches(/^(?=.*[1-9])(?:0|[1-9]\d*)(?:\.\d{1,7})?$/)
  amount: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(12)
  asset: string;

  @IsString()
  @Matches(/^G[A-Z2-7]{55}$/)
  counterpartyAddress: string;

  @IsDateString()
  deadline: string;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreationMilestoneDto)
  milestones: CreationMilestoneDto[];

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreationConditionDto)
  conditions: CreationConditionDto[];
}

export class SubmitEscrowCreationDto {
  @IsString()
  @IsNotEmpty()
  signedXdr: string;
}
