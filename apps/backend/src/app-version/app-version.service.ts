import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AppVersionInfo {
  minSupportedVersion: string;
  latestVersion: string;
  updateUrl: string;
}

@Injectable()
export class AppVersionService {
  constructor(private readonly configService: ConfigService) {}

  getVersionInfo(): AppVersionInfo {
    return {
      minSupportedVersion: this.configService.get<string>(
        'APP_MIN_SUPPORTED_VERSION',
        '1.0.0',
      ),
      latestVersion: this.configService.get<string>(
        'APP_LATEST_VERSION',
        '1.0.0',
      ),
      updateUrl: this.configService.get<string>(
        'APP_UPDATE_URL',
        'https://apps.apple.com/app/vaultix/id0000000000',
      ),
    };
  }
}
