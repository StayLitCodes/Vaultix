import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CancelEscrowDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @MaxLength(1000)
  reason?: string;
}
