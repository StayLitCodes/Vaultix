import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { WebhookService } from '../../services/webhook/webhook.service';
import { WebhookEvent } from '../../types/webhook/webhook.types';
import { AuthGuard } from '../auth/middleware/auth.guard';
import { ThrottlerGuard } from '@nestjs/throttler';

class CreateWebhookDto {
  url: string;
  secret: string;
  events: WebhookEvent[];
}

@Controller('webhooks')
@UseGuards(AuthGuard)
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @UseInterceptors(ThrottlerGuard)
  async create(
    @Req() req: { user: { id: string } },
    @Body() dto: CreateWebhookDto,
  ) {
    const userId = req?.user?.id;
    if (!userId) throw new Error('User ID missing');
    return this.webhookService.createWebhook(
      userId,
      dto.url,
      dto.secret,
      dto.events,
    );
  }

  @Get()
  async list(@Req() req: { user: { id: string } }) {
    const userId = req?.user?.id;
    if (!userId) throw new Error('User ID missing');
    return this.webhookService.getUserWebhooks(userId);
  }

  @Delete(':id')
  async remove(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    const userId = req?.user?.id;
    if (!userId) throw new Error('User ID missing');
    await this.webhookService.deleteWebhook(userId, id);
    return { success: true };
  }
}
