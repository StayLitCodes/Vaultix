import { AuthGuard } from '../modules/auth/middleware/auth.guard';
import { NotificationService } from './notifications.service';
import { PreferenceService } from './preference.service';
import {
  Body,
  Controller,
  Get,
  ParseArrayPipe,
  Patch,
  Put,
  Req,
  UseGuards,
  Post,
} from '@nestjs/common';
import { Request } from 'express';
import { UpdatePreferencesDto } from './entities/update-preferences.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    walletAddress: string;
  };
}

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationController {
  constructor(
    private preferenceService: PreferenceService,
    private notificationService: NotificationService,
  ) {}

  @Get('preferences')
  getPreferences(@Req() req: AuthenticatedRequest) {
    // Returns existing prefs, or seeds and returns defaults for users who never set any
    return this.preferenceService.seedDefaultPreferences(req.user.userId);
  }

  @Patch('preferences')
  updatePreferences(
    @Req() req: AuthenticatedRequest,
    @Body(new ParseArrayPipe({ items: UpdatePreferencesDto, whitelist: true }))
    dto: UpdatePreferencesDto[],
  ) {
    return this.preferenceService.updatePreferences(req.user.userId, dto);
  }

  // Kept for backward compatibility with older clients; PATCH is preferred.
  @Put('preferences')
  replacePreferences(
    @Req() req: AuthenticatedRequest,
    @Body(new ParseArrayPipe({ items: UpdatePreferencesDto, whitelist: true }))
    dto: UpdatePreferencesDto[],
  ) {
    return this.preferenceService.updatePreferences(req.user.userId, dto);
  }

  @Get()
  getNotifications(@Req() req: AuthenticatedRequest) {
    return this.notificationService.getUserNotifications(req.user.userId);
  }

  @Get('unread-count')
  getUnreadCount(@Req() req: AuthenticatedRequest) {
    return this.notificationService.getUnreadCount(req.user.userId);
  }

  @Post('mark-as-read')
  async markAsRead(
    @Req() req: AuthenticatedRequest,
    @Body('notificationId') notificationId?: string,
  ) {
    return this.notificationService.markAsRead(req.user.userId, notificationId);
  }
}
