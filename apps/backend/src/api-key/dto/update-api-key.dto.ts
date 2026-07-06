import { IsString, IsOptional, IsArray, IsEnum, IsBoolean } from 'class-validator';
import { ApiKeyScope } from '../entities/api-key.entity';

export class UpdateApiKeyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(ApiKeyScope, { each: true })
  scopes?: ApiKeyScope[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
