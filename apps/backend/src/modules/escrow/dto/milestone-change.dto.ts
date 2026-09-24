import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsNotEmpty,
  Matches,
  MaxLength,
} from 'class-validator';

export class ProposeMilestoneChangeDto {
  @ApiPropertyOptional({
    description: 'The proposed new amount for this milestone',
    example: '100.5',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,38})(?:\.\d+)?$/)
  amount?: string;

  @ApiPropertyOptional({
    description: 'The proposed new description for this milestone',
    example: 'Deliver the first draft of the integration module',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description?: string;
}
