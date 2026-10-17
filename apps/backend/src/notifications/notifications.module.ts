import { Module, forwardRef } from '@nestjs/common';
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
import { User } from '../modules/user/entities/user.entity';
import { DigestService } from './digest.service';
import { EmailModule } from '../email/email.module';
import { EventsModule } from '../gateways/events.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => AuthModule),
    EmailModule,
    EventsModule,
    TypeOrmModule.forFeature([Notification, NotificationPreference, User]),
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    PreferenceService,
    DigestService,
    EmailSender,
    WebhookSender,
  ],
  exports: [NotificationService, PreferenceService],
})
export class NotificationsModule {}
