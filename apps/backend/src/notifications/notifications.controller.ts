import { AuthGuard } from "@nestjs/passport";
import { NotificationService } from "./notifications.service";
import { PreferenceService } from "./preference.service";
import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import { UpdatePreferencesDto } from "./entities/update-preferences.dto";

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationController {
  constructor(
    private preferenceService: PreferenceService,
    private notificationService: NotificationService,
  ) {}

  @Get('preferences')
  getPreferences(@Req() req) {
    return this.preferenceService.getUserPreferences(req.user.id);
  }

  @Put('preferences')
  updatePreferences(@Req() req, @Body() dto: UpdatePreferencesDto[]) {
    return this.preferenceService.updatePreferences(req.user.id, dto);
  }

  @Get()
  getNotifications(@Req() req) {
    return this.notificationService.getUserNotifications(req.user.id);
  }
}
