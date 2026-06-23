import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppVersionController } from './app-version.controller';
import { AppVersionService } from './app-version.service';

@Module({
  imports: [ConfigModule],
  controllers: [AppVersionController],
  providers: [AppVersionService],
})
export class AppVersionModule {}
