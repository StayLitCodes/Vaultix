import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../modules/auth/auth.module';
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationController } from './notifications.controller';
import { NotificationService } from './notifications.service';
import { PreferenceService } from './preference.service';
import { EmailSender } from './senders/email.sender';
import { WebhookSender } from './senders/webhook.sender';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    TypeOrmModule.forFeature([Notification, NotificationPreference]),
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    PreferenceService,
    EmailSender,
    WebhookSender,
  ],
  exports: [NotificationService, PreferenceService],
})
export class NotificationsModule {}
