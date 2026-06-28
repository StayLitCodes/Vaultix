import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { WebhookService } from '../../services/webhook/webhook.service';
import { WebhookEvent } from '../../types/webhook/webhook.types';
import { AuthGuard } from '../auth/middleware/auth.guard';
import { ThrottlerGuard } from '@nestjs/throttler';

class CreateWebhookDto {
  url: string;
  secret?: string;
  events: WebhookEvent[];
}

class UpdateWebhookDto {
  url?: string;
  events?: WebhookEvent[];
  isActive?: boolean;
}

@Controller('webhooks')
@UseGuards(AuthGuard)
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @UseGuards(ThrottlerGuard)
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

  @Patch(':id')
  async update(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    const userId = req?.user?.id;
    if (!userId) throw new Error('User ID missing');
    return this.webhookService.updateWebhook(userId, id, dto);
  }

  @Get(':id/deliveries')
  async deliveries(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    const userId = req?.user?.id;
    if (!userId) throw new Error('User ID missing');
    return this.webhookService.getWebhookDeliveries(userId, id);
  }

  @Post(':id/retry')
  async retry(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    const userId = req?.user?.id;
    if (!userId) throw new Error('User ID missing');
    return this.webhookService.retryWebhookDelivery(userId, id);
  }

  @Post(':id/test')
  async test(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    const userId = req?.user?.id;
    if (!userId) throw new Error('User ID missing');
    return this.webhookService.testWebhook(userId, id);
  }

  @Delete(':id')
  async remove(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    const userId = req?.user?.id;
    if (!userId) throw new Error('User ID missing');
    await this.webhookService.deleteWebhook(userId, id);
    return { success: true };
  }
}
