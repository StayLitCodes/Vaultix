import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({ description: 'Name of the API key', example: 'Production Key' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Rate limit per minute for this key', example: 60 })
  @IsOptional()
  @IsInt()
  @Min(1)
  rateLimitPerMinute?: number;
}
