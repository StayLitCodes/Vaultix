import { IsString, IsOptional, IsArray, IsEnum, IsDateString } from 'class-validator';
import { ApiKeyScope } from '../entities/api-key.entity';

export class CreateApiKeyDto {
  @IsString()
  name: string;

  @IsArray()
  @IsEnum(ApiKeyScope, { each: true })
  scopes: ApiKeyScope[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
