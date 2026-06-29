import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppVersionService, AppVersionInfo } from './app-version.service';

@Controller('api/app')
@ApiTags('app-version')
export class AppVersionController {
  constructor(private readonly appVersionService: AppVersionService) {}

  @Get('version')
  @ApiOperation({ summary: 'Get the current app version metadata' })
  @ApiResponse({ status: HttpStatus.OK, description: 'App version information retrieved successfully' })
  getVersion(): AppVersionInfo {
    return this.appVersionService.getVersionInfo();
  }
}
