import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '../../auth/middleware/auth.guard';
import { AdminGuard } from '../../auth/middleware/admin.guard';
import { WebhookService } from '../../../services/webhook/webhook.service';

@Controller('admin/webhooks')
@UseGuards(AuthGuard, AdminGuard)
export class AdminWebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Get('failed')
  async getFailedDeliveries(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('webhookId') webhookId?: string,
  ) {
    const parsedPage = Number.parseInt(page, 10);
    const parsedLimit = Number.parseInt(limit, 10);

    return this.webhookService.getFailedDelveys({
      page: Number.isNaN(parsedPage) ? 1 : parsedPage,
      limit: Number.isNaN(parsedLimit) ? 20 : parsedLimit,
      webhookId,
    });
  }

  @Post(':deliveryId/retry')
  @HttpCode(HttpStatus.OK)
  async manualRetry(@Param('deliveryId') deliveryId: string) {
    return this.webhookService.manualRetry(deliveryId);
  }

  @Get('health')
  async getHealthStats() {
    return this.webhookService.getHealthStats();
  }
}
