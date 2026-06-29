import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FulfillConditionDto {
  @ApiPropertyOptional({ description: 'Notes explaining the condition fulfillment', example: 'Delivered the first draft' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Evidence supporting the fulfillment', example: 'https://example.com/evidence.pdf' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  evidence?: string;
}
