import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ApiKeysService } from './api-key.service';
import { ApiKeyController } from './api-key.controller';
import { ApiKey } from './entities/api-key.entity';
import { ApiRateLimitService } from './api-rate-limit.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ApiKeyScheduler } from './api-key.scheduler';
import { AuthModule } from '../modules/auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKey]), AuthModule, ScheduleModule.forRoot()],
  controllers: [ApiKeyController],
  providers: [ApiKeysService, ApiRateLimitService, ApiKeyGuard, ApiKeyScheduler],
  exports: [ApiKeysService, ApiRateLimitService, ApiKeyGuard],
})
export class ApiKeyModule {}
