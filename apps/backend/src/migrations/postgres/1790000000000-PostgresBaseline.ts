import { MigrationInterface, QueryRunner } from 'typeorm';
import { InitialMigration1774364374006 } from '../1774364374006-InitialMigration';
import { AddReadAtToNotification1774364375000 } from '../1774364375000-AddReadAtToNotification';
import { AddMilestoneProposals1774476566443 } from '../1774476566443-AddMilestoneProposals';
import { ImplementFourFeatures1780262000000 } from '../1780262000000-ImplementFourFeatures';
import { AddRespondedAtToParty1780300000000 } from '../1780300000000-AddRespondedAtToParty';
import { AddWebhookDeliveryTable1780400000000 } from '../1780400000000-AddWebhookDeliveryTable';
import { AddEvidenceFilesToDispute1780500000000 } from '../1780500000000-AddEvidenceFilesToDispute';
import { UpdateApiKeySchema1780500000000 } from '../1780500000000-UpdateApiKeySchema';
import { AddIpfsMetadataToEscrows1780600000000 } from '../1780600000000-AddIpfsMetadataToEscrows';
import { AddEmailOutboxTable1780700000000 } from '../1780700000000-AddEmailOutboxTable';
import { AddKycAndAml1780700000000 } from '../1780700000000-AddKycAndAml';
import { AddWebhookDeadLetterTable1780800000000 } from '../1780800000000-AddWebhookDeadLetterTable';
import { AddIdempotencyKeyToNotification1780900000000 } from '../1780900000000-AddIdempotencyKeyToNotification';
import { MakeNotificationIdempotencyKeyUnique1781000000000 } from '../1781000000000-MakeNotificationIdempotencyKeyUnique';

const migrations: MigrationInterface[] = [
  new InitialMigration1774364374006(),
  new AddReadAtToNotification1774364375000(),
  new AddMilestoneProposals1774476566443(),
  new ImplementFourFeatures1780262000000(),
  new AddRespondedAtToParty1780300000000(),
  new AddWebhookDeliveryTable1780400000000(),
  new AddEvidenceFilesToDispute1780500000000(),
  new UpdateApiKeySchema1780500000000(),
  new AddIpfsMetadataToEscrows1780600000000(),
  new AddEmailOutboxTable1780700000000(),
  new AddKycAndAml1780700000000(),
  new AddWebhookDeadLetterTable1780800000000(),
  new AddIdempotencyKeyToNotification1780900000000(),
  new MakeNotificationIdempotencyKeyUnique1781000000000(),
];

function normalizeSql(sql: string): string {
  return sql
    .replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/\bdatetime\b/gi, 'timestamp')
    .replace(/boolean NOT NULL DEFAULT \(1\)/gi, 'boolean NOT NULL DEFAULT TRUE')
    .replace(/boolean NOT NULL DEFAULT \(0\)/gi, 'boolean NOT NULL DEFAULT FALSE');
}

function postgresQueryRunner(queryRunner: QueryRunner): QueryRunner {
  return new Proxy(queryRunner, {
    get(target, property, receiver) {
      if (property === 'query') {
        return (sql: string, parameters?: unknown[]) =>
          target.query(normalizeSql(sql), parameters);
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

/**
 * Runs the existing migration history through a small SQL compatibility layer.
 * This keeps one schema history while translating SQLite date/default syntax.
 */
export class PostgresBaseline1790000000000 implements MigrationInterface {
  name = 'PostgresBaseline1790000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const compatibleRunner = postgresQueryRunner(queryRunner);
    for (const migration of migrations) {
      await migration.up(compatibleRunner);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const compatibleRunner = postgresQueryRunner(queryRunner);
    for (const migration of [...migrations].reverse()) {
      await migration.down(compatibleRunner);
    }
  }
}
