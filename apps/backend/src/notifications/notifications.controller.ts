import { AuthGuard } from '../modules/auth/middleware/auth.guard';
import { NotificationService } from './notifications.service';
import { PreferenceService } from './preference.service';
import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  UseGuards,
  Post,
} from '@nestjs/common';
import { Request } from 'express';
import { UpdatePreferencesDto } from './entities/update-preferences.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiBody,
} from '@nestjs/swagger';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationController {
  constructor(
    private preferenceService: PreferenceService,
    private notificationService: NotificationService,
  ) {}

  @Get('preferences')
  @ApiOperation({ summary: 'Get user notification preferences' })
  @ApiOkResponse({ description: 'Preferences retrieved' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getPreferences(@Req() req: AuthenticatedRequest) {
    return this.preferenceService.getUserPreferences(req.user.id);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update user notification preferences' })
  @ApiBody({ type: [UpdatePreferencesDto] })
  @ApiOkResponse({ description: 'Preferences updated' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  updatePreferences(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdatePreferencesDto[],
  ) {
    return this.preferenceService.updatePreferences(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiOkResponse({ description: 'Notifications retrieved' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getNotifications(@Req() req: AuthenticatedRequest) {
    return this.notificationService.getUserNotifications(req.user.id);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiOkResponse({ description: 'Unread count retrieved' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getUnreadCount(@Req() req: AuthenticatedRequest) {
    return this.notificationService.getUnreadCount(req.user.id);
  }

  @Post('mark-as-read')
  @ApiOperation({ summary: 'Mark notifications as read' })
  @ApiBody({ schema: { type: 'object', properties: { notificationId: { type: 'string' } } } })
  @ApiOkResponse({ description: 'Notification(s) marked as read' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async markAsRead(
    @Req() req: AuthenticatedRequest,
    @Body('notificationId') notificationId?: string,
  ) {
    return this.notificationService.markAsRead(req.user.id, notificationId);
  }
}
