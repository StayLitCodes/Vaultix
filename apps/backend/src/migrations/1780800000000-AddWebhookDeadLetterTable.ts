import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWebhookDeadLetterTable1780800000000 implements MigrationInterface {
  name = 'AddWebhookDeadLetterTable1780800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "webhook_dead_letter" (
        "id" varchar PRIMARY KEY,
        "webhookId" varchar NOT NULL,
        "originalDeliveryId" varchar,
        "event" varchar NOT NULL,
        "payload" text NOT NULL,
        "attempts" integer NOT NULL DEFAULT 0,
        "lastStatusCode" integer,
        "lastError" text,
        "failedAt" datetime NOT NULL DEFAULT (datetime('now')),
        "replayedAt" datetime,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        CONSTRAINT "FK_webhook_dead_letter_webhook" FOREIGN KEY ("webhookId") REFERENCES "webhooks"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_webhook_dead_letter_webhook" ON "webhook_dead_letter" ("webhookId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_webhook_dead_letter_webhook"`,
    );
    await queryRunner.query(`DROP TABLE "webhook_dead_letter"`);
  }
}
