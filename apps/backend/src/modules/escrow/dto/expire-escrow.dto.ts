import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class ExpireEscrowDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @MaxLength(1000)
  reason?: string;
}
