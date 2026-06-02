import { IsString, IsOptional, IsDateString, MaxLength } from 'class-validator';

export class UpdateEscrowDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
