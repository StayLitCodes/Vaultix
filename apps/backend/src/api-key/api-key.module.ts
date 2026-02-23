import { Module } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { ApiKeyController } from './api-key.controller';

@Module({
  controllers: [ApiKeyController],
  providers: [ApiKeyService],
})
export class ApiKeyModule {}
