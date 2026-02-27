import { IsString, IsOptional, MaxLength } from 'class-validator';

export class ExpireEscrowDto {
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reason?: string;
}
