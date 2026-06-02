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

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
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
    return this.preferenceService.getUserPreferences(req.user.id);
  }

  @Put('preferences')
  updatePreferences(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdatePreferencesDto[],
  ) {
    return this.preferenceService.updatePreferences(req.user.id, dto);
  }

  @Get()
  getNotifications(@Req() req: AuthenticatedRequest) {
    return this.notificationService.getUserNotifications(req.user.id);
  }

  @Get('unread-count')
  getUnreadCount(@Req() req: AuthenticatedRequest) {
    return this.notificationService.getUnreadCount(req.user.id);
  }

  @Post('mark-as-read')
  async markAsRead(
    @Req() req: AuthenticatedRequest,
    @Body('notificationId') notificationId?: string,
  ) {
    return this.notificationService.markAsRead(req.user.id, notificationId);
  }
}
