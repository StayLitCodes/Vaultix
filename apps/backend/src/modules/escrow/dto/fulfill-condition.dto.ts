import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class FulfillConditionDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @MaxLength(500)
  evidence?: string;
}
