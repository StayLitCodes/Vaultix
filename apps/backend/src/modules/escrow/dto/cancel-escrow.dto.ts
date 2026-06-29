import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CancelEscrowDto {
  @ApiPropertyOptional({ description: 'Reason for canceling the escrow', example: 'The buyer no longer needs the service' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reason?: string;
}
