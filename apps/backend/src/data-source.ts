import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from './modules/user/entities/user.entity';
import { RefreshToken } from './modules/user/entities/refresh-token.entity';
import { EmailVerification } from './modules/user/entities/email-verification.entity';
import { Escrow } from './modules/escrow/entities/escrow.entity';
import { Party } from './modules/escrow/entities/party.entity';
import { Condition } from './modules/escrow/entities/condition.entity';
import { EscrowEvent } from './modules/escrow/entities/escrow-event.entity';
import { Dispute } from './modules/escrow/entities/dispute.entity';
import { Notification } from './notifications/entities/notification.entity';
import { NotificationPreference } from './notifications/entities/notification-preference.entity';
import { ApiKey } from './api-key/entities/api-key.entity';
import { AdminAuditLog } from './modules/admin/entities/admin-audit-log.entity';
import { Webhook } from './modules/webhook/webhook.entity';
import { WebhookDelivery } from './modules/webhook/entities/webhook-delivery.entity';
import { WebhookDeadLetter } from './modules/webhook/entities/webhook-dead-letter.entity';
import { StellarEvent } from './modules/stellar/entities/stellar-event.entity';
import { AllowedAsset } from './modules/assets/entities/allowed-asset.entity';
import { EmailOutbox } from './email/entities/email-outbox.entity';

config(); // Load .env file

const isPostgres = process.env.DATABASE_DRIVER === 'postgres';

export default new DataSource(
  isPostgres
    ? {
        type: 'postgres',
        url: process.env.DATABASE_URL,
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
        migrations: ['./src/migrations/*.ts'],
        synchronize: false,
        extra: {
          max: 20,
          idleTimeoutMillis: 30000,
        },
      }
    : {
        type: 'sqlite',
        database: process.env.DATABASE_PATH || './data/vaultix.db',
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
        migrations: ['./src/migrations/*.ts'],
        synchronize: false,
      },
);
