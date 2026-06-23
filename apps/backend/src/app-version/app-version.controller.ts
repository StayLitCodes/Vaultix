import { Controller, Get } from '@nestjs/common';
import { AppVersionService, AppVersionInfo } from './app-version.service';

@Controller('api/app')
export class AppVersionController {
  constructor(private readonly appVersionService: AppVersionService) {}

  @Get('version')
  getVersion(): AppVersionInfo {
    return this.appVersionService.getVersionInfo();
  }
}
