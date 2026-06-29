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
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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
@ApiTags('webhooks')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @UseInterceptors(ThrottlerGuard)
  @ApiOperation({ summary: 'Create a webhook subscription for the authenticated user' })
  @ApiBody({ description: 'Webhook registration payload', type: CreateWebhookDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Webhook created successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid webhook payload' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
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
  @ApiOperation({ summary: 'List webhooks owned by the authenticated user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Webhooks retrieved successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  async list(@Req() req: { user: { id: string } }) {
    const userId = req?.user?.id;
    if (!userId) throw new Error('User ID missing');
    return this.webhookService.getUserWebhooks(userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a webhook by ID' })
  @ApiParam({ name: 'id', description: 'Webhook ID to delete' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Webhook deleted successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Webhook not found' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  async remove(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    const userId = req?.user?.id;
    if (!userId) throw new Error('User ID missing');
    await this.webhookService.deleteWebhook(userId, id);
    return { success: true };
  }
}
