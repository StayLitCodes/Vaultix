import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeysService } from './api-key.service';
import { ApiKeyController } from './api-key.controller';
import { ApiKey } from './entities/api-key.entity';
import { ApiRateLimitService } from './api-rate-limit.service';
import { ApiKeyGuard } from './guards/api-key.guard';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKey])],
  controllers: [ApiKeyController],
  providers: [ApiKeysService, ApiRateLimitService, ApiKeyGuard],
  exports: [ApiKeysService, ApiRateLimitService, ApiKeyGuard],
})
export class ApiKeyModule {}
