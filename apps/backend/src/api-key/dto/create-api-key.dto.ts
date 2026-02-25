import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  rateLimitPerMinute?: number;
}
