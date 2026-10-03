import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import {
  buildDatabaseConnectionOptions,
  getDatabaseType,
} from './config/database.config';
import { User } from './modules/user/entities/user.entity';
import { RefreshToken } from './modules/user/entities/refresh-token.entity';
import { EmailVerification } from './modules/user/entities/email-verification.entity';
import { Escrow } from './modules/escrow/entities/escrow.entity';
import { EscrowCreationIntent } from './modules/escrow/entities/escrow-creation-intent.entity';
import { SorobanTxIntent } from './modules/escrow/entities/soroban-tx-intent.entity';
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
import { BackupRecord } from './modules/backup/entities/backup-record.entity';
import { KycVerification } from './modules/kyc/entities/kyc-verification.entity';
import { EscrowChainId } from './modules/escrow/entities/escrow-chain-id.entity';

config(); // Load .env file

const databaseType = getDatabaseType();

export default new DataSource({
  ...buildDatabaseConnectionOptions(),
  entities: [
    User,
    RefreshToken,
    EmailVerification,
    Escrow,
    EscrowCreationIntent,
    SorobanTxIntent,
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
    BackupRecord,
    KycVerification,
    EscrowChainId,
  ],
  migrations:
    databaseType === 'postgres'
      ? ['./src/migrations-postgres/*.ts']
      : ['./src/migrations/*.ts'],
  synchronize: false,
} as import('typeorm').DataSourceOptions);
