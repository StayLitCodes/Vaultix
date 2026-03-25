import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CancelEscrowDto {
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reason?: string;
}
