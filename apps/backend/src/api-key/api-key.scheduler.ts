import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApiKeysService } from './api-key.service';

@Injectable()
export class ApiKeyScheduler {
  private readonly logger = new Logger(ApiKeyScheduler.name);

  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiredKeys() {
    try {
      const deactivatedCount = await this.apiKeysService.deactivateExpiredKeys();
      
      if (deactivatedCount > 0) {
        this.logger.log(`Deactivated ${deactivatedCount} expired API keys`);
      }
    } catch (error) {
      this.logger.error('Failed to deactivate expired keys', error);
    }
  }
}