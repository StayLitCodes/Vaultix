import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Import all entities
import { User } from '../modules/user/entities/user.entity';
import { RefreshToken } from '../modules/user/entities/refresh-token.entity';
import { EmailVerification } from '../modules/user/entities/email-verification.entity';
import { Escrow } from '../modules/escrow/entities/escrow.entity';
import { Party } from '../modules/escrow/entities/party.entity';
import { Condition } from '../modules/escrow/entities/condition.entity';
import { EscrowEvent } from '../modules/escrow/entities/escrow-event.entity';
import { Dispute } from '../modules/escrow/entities/dispute.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { NotificationPreference } from '../notifications/entities/notification-preference.entity';
import { ApiKey } from '../api-key/entities/api-key.entity';
import { AdminAuditLog } from '../modules/admin/entities/admin-audit-log.entity';
import { Webhook } from '../modules/webhook/webhook.entity';
import { WebhookDelivery } from '../modules/webhook/entities/webhook-delivery.entity';
import { WebhookDeadLetter } from '../modules/webhook/entities/webhook-dead-letter.entity';
import { StellarEvent } from '../modules/stellar/entities/stellar-event.entity';
import { AllowedAsset } from '../modules/assets/entities/allowed-asset.entity';
import { EmailOutbox } from '../email/entities/email-outbox.entity';

config();

const entities = [
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
];

async function migrate() {
  console.log('Starting migration from SQLite to PostgreSQL...');

  const sqlitePath = process.env.DATABASE_PATH || './data/vaultix.db';
  if (!fs.existsSync(sqlitePath)) {
    console.error(`SQLite database not found at ${sqlitePath}`);
    process.exit(1);
  }

  const pgUrl = process.env.DATABASE_URL;
  if (!pgUrl) {
    console.error('DATABASE_URL must be set for PostgreSQL');
    process.exit(1);
  }

  const sqliteDataSource = new DataSource({
    type: 'sqlite',
    database: sqlitePath,
    entities,
    synchronize: false,
  });

  const pgDataSource = new DataSource({
    type: 'postgres',
    url: pgUrl,
    entities,
    synchronize: false,
    migrations: [path.join(__dirname, '../migrations/*.ts')],
    migrationsRun: true,
  });

  try {
    console.log('Connecting to SQLite...');
    await sqliteDataSource.initialize();

    console.log('Connecting to PostgreSQL and running migrations...');
    await pgDataSource.initialize();

    console.log('Connected to both databases. Starting data transfer...');

    for (const entity of entities) {
      const entityName = entity.name;
      console.log(`\nMigrating ${entityName}...`);

      const sqliteRepo = sqliteDataSource.getRepository(entity);
      const pgRepo = pgDataSource.getRepository(entity);

      const records = await sqliteRepo.find();
      console.log(`Found ${records.length} records in SQLite.`);

      if (records.length > 0) {
        // To avoid conflicts and duplicate keys, we insert them one by one or in batches
        // and ignore on conflict if possible, but standard save handles it usually,
        // though we might want to just use insert to be safe.
        // Some entities have relations, so order matters. The entities array is ordered
        // generally to respect dependencies (User before others, Escrow before Party, etc.)

        let successCount = 0;
        let errorCount = 0;

        for (const record of records) {
          try {
            await pgRepo.save(record);
            successCount++;
          } catch (error) {
            console.error(
              `Failed to migrate record in ${entityName}:`,
              error instanceof Error ? error.message : String(error),
            );
            errorCount++;
          }
        }
        console.log(
          `Finished ${entityName}: ${successCount} successful, ${errorCount} failed.`,
        );
      }
    }

    console.log('\nMigration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    if (sqliteDataSource.isInitialized) {
      await sqliteDataSource.destroy();
    }
    if (pgDataSource.isInitialized) {
      await pgDataSource.destroy();
    }
  }
}

migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
