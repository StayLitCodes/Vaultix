import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationService } from './notifications.service';
import { PreferenceService } from './preference.service';
import { EmailSender } from './senders/email.sender';
import { WebhookSender } from './senders/webhook.sender';
import { NotificationController } from './notifications.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationPreference]),
  ],
  providers: [
    NotificationService,
    PreferenceService,
    EmailSender,
    WebhookSender,
  ],
  controllers: [NotificationController],
  exports: [NotificationService],
})
export class NotificationsModule {}
