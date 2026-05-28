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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiProperty,
} from '@nestjs/swagger';

class CreateWebhookDto {
  @ApiProperty({ description: 'URL to send the webhook payload to', example: 'https://my-app.com/webhook' })
  url: string;

  @ApiProperty({ description: 'Secret used to sign the webhook payload for verification', example: 'my-super-secret-key' })
  secret: string;

  @ApiProperty({ description: 'Events to subscribe to', enum: ['escrow.created', 'escrow.funded', 'escrow.completed'], isArray: true, example: ['escrow.funded'] })
  events: WebhookEvent[];
}

@ApiTags('Webhooks')
@ApiBearerAuth()
@Controller('webhooks')
@UseGuards(AuthGuard)
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @UseInterceptors(ThrottlerGuard)
  @ApiOperation({ summary: 'Create webhook', description: 'Creates a new webhook subscription for the authenticated user.' })
  @ApiOkResponse({ description: 'Webhook created' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
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
  @ApiOperation({ summary: 'List webhooks', description: 'Retrieves all webhook subscriptions for the authenticated user.' })
  @ApiOkResponse({ description: 'Webhooks retrieved' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async list(@Req() req: { user: { id: string } }) {
    const userId = req?.user?.id;
    if (!userId) throw new Error('User ID missing');
    return this.webhookService.getUserWebhooks(userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete webhook', description: 'Removes a webhook subscription by ID.' })
  @ApiOkResponse({ description: 'Webhook deleted' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async remove(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    const userId = req?.user?.id;
    if (!userId) throw new Error('User ID missing');
    await this.webhookService.deleteWebhook(userId, id);
    return { success: true };
  }
}
