import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validateJwtSecret } from './modules/auth/services/jwt-validation.util';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';
import { LoggerModule } from 'nestjs-pino';
import * as crypto from 'crypto';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { StellarModule } from './modules/stellar/stellar.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { User } from './modules/user/entities/user.entity';
import { RefreshToken } from './modules/user/entities/refresh-token.entity';
import { EmailVerification } from './modules/user/entities/email-verification.entity';
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
import { WebhookDelivery } from './modules/webhook/entities/webhook-delivery.entity';
import { WebhookDeadLetter } from './modules/webhook/entities/webhook-dead-letter.entity';
import { StellarEvent } from './modules/stellar/entities/stellar-event.entity';
import { AdminModule } from './modules/admin/admin.module';
import { StellarEventModule } from './modules/stellar/stellar-event.module';
import { AssetsModule } from './modules/assets/assets.module';
import { AllowedAsset } from './modules/assets/entities/allowed-asset.entity';
import { IpfsModule } from './modules/ipfs/ipfs.module';
import { HealthModule } from './modules/health/health.module';
import { AppVersionModule } from './app-version/app-version.module';
import { EmailModule } from './email/email.module';
import { EmailOutbox } from './email/entities/email-outbox.entity';
import stellarConfig from './config/stellar.config';
import ipfsConfig from './config/ipfs.config';
import emailConfig from './config/email.config';
import webhookConfig from './config/webhook.config';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return {
          pinoHttp: {
            level: config.get('LOG_LEVEL', 'info'),
            genReqId: (req) => {
              return req.headers['x-request-id'] || crypto.randomUUID();
            },
            transport:
              config.get('NODE_ENV') !== 'production'
                ? {
                    target: 'pino-pretty',
                    options: {
                      singleLine: true,
                    },
                  }
                : undefined,
          },
        };
      },
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [stellarConfig, ipfsConfig, emailConfig, webhookConfig],
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
          EmailVerification,
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
          WebhookDelivery,
          WebhookDeadLetter,
          StellarEvent,
          AllowedAsset,
          EmailOutbox,
        ],
        synchronize: false,
        migrations: [__dirname + '/migrations/*.ts'],
        migrationsRun: true,
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
    AssetsModule,
    IpfsModule,
    HealthModule,
    AppVersionModule,
    EmailModule,
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: validateJwtSecret(configService.get<string>('JWT_SECRET')),
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
