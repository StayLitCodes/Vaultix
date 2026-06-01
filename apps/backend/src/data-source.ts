import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from './modules/user/entities/user.entity';
import { RefreshToken } from './modules/user/entities/refresh-token.entity';
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
import { StellarEvent } from './modules/stellar/entities/stellar-event.entity';
import { AllowedAsset } from './modules/assets/entities/allowed-asset.entity';

config(); // Load .env file

const databaseUrl = process.env.DATABASE_URL;
const sqlitePath = process.env.DATABASE_PATH || './data/vaultix.db';
const usePostgres = Boolean(databaseUrl);
const sslEnabled = process.env.DATABASE_SSL === 'true';

const commonOptions = {
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
    AllowedAsset,
  ],
  migrations: ['./src/migrations/*.ts'],
  synchronize: false,
};

const postgresOptions = {
  type: 'postgres' as const,
  url: databaseUrl,
  ssl: sslEnabled ? { rejectUnauthorized: false } : false,
  extra: {
    min: 2,
    max: 10,
  },
};

const sqliteOptions = {
  type: 'better-sqlite3' as const,
  database: sqlitePath,
};

export default new DataSource(
  usePostgres
    ? {
        ...commonOptions,
        ...postgresOptions,
      }
    : {
        ...commonOptions,
        ...sqliteOptions,
      },
);
