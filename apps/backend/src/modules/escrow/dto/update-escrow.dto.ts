import { IsString, IsOptional, IsDateString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEscrowDto {
  @ApiPropertyOptional({ description: 'Updated escrow title', example: 'Updated website redesign' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Updated escrow description', example: 'Updated scope for the landing page' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'Updated expiry date for the escrow', example: '2026-12-31T23:59:59.000Z' })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
