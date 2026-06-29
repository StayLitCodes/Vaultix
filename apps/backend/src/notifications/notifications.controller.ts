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
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { UpdatePreferencesDto } from './entities/update-preferences.dto';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
}

@Controller('notifications')
@ApiTags('notifications')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
export class NotificationController {
  constructor(
    private preferenceService: PreferenceService,
    private notificationService: NotificationService,
  ) {}

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences for the authenticated user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Preferences retrieved successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  getPreferences(@Req() req: AuthenticatedRequest) {
    return this.preferenceService.getUserPreferences(req.user.id);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update notification preferences for the authenticated user' })
  @ApiBody({ type: [UpdatePreferencesDto], description: 'Notification preference updates' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Preferences updated successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid preferences payload' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  updatePreferences(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdatePreferencesDto[],
  ) {
    return this.preferenceService.updatePreferences(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List notifications for the authenticated user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Notifications retrieved successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  getNotifications(@Req() req: AuthenticatedRequest) {
    return this.notificationService.getUserNotifications(req.user.id);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get the unread notification count for the authenticated user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Unread count retrieved successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  getUnreadCount(@Req() req: AuthenticatedRequest) {
    return this.notificationService.getUnreadCount(req.user.id);
  }

  @Post('mark-as-read')
  @ApiOperation({ summary: 'Mark one or more notifications as read' })
  @ApiBody({ description: 'Notification ID to mark as read', schema: { type: 'object', properties: { notificationId: { type: 'string' } } } })
  @ApiResponse({ status: HttpStatus.OK, description: 'Notifications marked as read' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid request payload' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  async markAsRead(
    @Req() req: AuthenticatedRequest,
    @Body('notificationId') notificationId?: string,
  ) {
    return this.notificationService.markAsRead(req.user.id, notificationId);
  }
}
