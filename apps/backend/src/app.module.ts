import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { StellarModule } from './modules/stellar/stellar.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { User } from './modules/user/entities/user.entity';
import { RefreshToken } from './modules/user/entities/refresh-token.entity';
import { Escrow } from './modules/escrow/entities/escrow.entity';
import { Party } from './modules/escrow/entities/party.entity';
import { Condition } from './modules/escrow/entities/condition.entity';
import { EscrowEvent } from './modules/escrow/entities/escrow-event.entity';
import { Dispute } from './modules/escrow/entities/dispute.entity';
import { NotificationsModule } from './notifications/notifications.module';
import { EscrowModule } from './modules/escrow/escrow.module';
import { ApiKeyModule } from './api-key/api-key.module';
import { Notification } from './notifications/entities/notification.entity';
import { NotificationPreference } from './notifications/entities/notification-preference.entity';
import { ApiKey } from './api-key/entities/api-key.entity';
import { AdminAuditLog } from './modules/admin/entities/admin-audit-log.entity';
import { Webhook } from './modules/webhook/webhook.entity';
import { StellarEvent } from './modules/stellar/entities/stellar-event.entity';
import { AdminModule } from './modules/admin/admin.module';
import { StellarEventModule } from './modules/stellar/stellar-event.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'sqlite',
        database: configService.get<string>(
          'DATABASE_PATH',
          './data/vaultix.db',
        ),
        entities: [
          User,
          RefreshToken,
          Escrow,
          Party,
          Condition,
          EscrowEvent,
          Dispute,
          Notification,
          NotificationPreference,
          ApiKey,
          AdminAuditLog,
          Webhook,
          StellarEvent,
        ],
        synchronize: process.env.NODE_ENV === 'test',
        migrations: [__dirname + '/migrations/*.ts'],
        migrationsRun: process.env.NODE_ENV !== 'test',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UserModule,
    EscrowModule,
    StellarModule,
    forwardRef(() => AdminModule),
    WebhookModule,
    NotificationsModule,
    ApiKeyModule,
    forwardRef(() => StellarEventModule),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
