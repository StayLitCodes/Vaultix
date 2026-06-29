import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { WebhookService } from '../../services/webhook/webhook.service';
import { WebhookEvent } from '../../types/webhook/webhook.types';
import { AuthGuard } from '../auth/middleware/auth.guard';

class CreateWebhookDto {
  url: string;
  secret: string;
  events: WebhookEvent[];
}

// GET/DELETE inherit the global 100/min IP-based default.
// POST /webhooks applies a stricter per-user limit.
@Controller('webhooks')
@UseGuards(AuthGuard)
@SkipThrottle({ user: true })
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @SkipThrottle({ user: false })
  @Throttle({ user: { limit: 10, ttl: 60_000 } })
  async create(
    @Req() req: { user: { id: string; sub?: string; userId?: string } },
    @Body() dto: CreateWebhookDto,
  ) {
    const userId = req?.user?.id ?? req?.user?.sub ?? req?.user?.userId;
    if (!userId) throw new Error('User ID missing');
    return this.webhookService.createWebhook(
      userId,
      dto.url,
      dto.secret,
      dto.events,
    );
  }

  @Get()
  async list(
    @Req() req: { user: { id: string; sub?: string; userId?: string } },
  ) {
    const userId = req?.user?.id ?? req?.user?.sub ?? req?.user?.userId;
    if (!userId) throw new Error('User ID missing');
    return this.webhookService.getUserWebhooks(userId);
  }

  @Delete(':id')
  async remove(
    @Req() req: { user: { id: string; sub?: string; userId?: string } },
    @Param('id') id: string,
  ) {
    const userId = req?.user?.id ?? req?.user?.sub ?? req?.user?.userId;
    if (!userId) throw new Error('User ID missing');
    await this.webhookService.deleteWebhook(userId, id);
    return { success: true };
  }
}
