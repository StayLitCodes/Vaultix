import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min } from 'class-validator';

export class ProposeMilestoneChangeDto {
  @ApiPropertyOptional({
    description: 'The proposed new amount for this milestone',
    example: 100.5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({
    description: 'The proposed new description for this milestone',
    example: 'Deliver the first draft of the integration module',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
