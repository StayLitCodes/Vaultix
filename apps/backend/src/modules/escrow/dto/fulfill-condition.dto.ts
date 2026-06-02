import { IsString, IsOptional, MaxLength } from 'class-validator';

export class FulfillConditionDto {
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  evidence?: string;
}
