import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWebhookDeliveryTable1780400000000 implements MigrationInterface {
  name = 'AddWebhookDeliveryTable1780400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "webhook_delivery" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "webhookId" uuid NOT NULL,
        "event" varchar NOT NULL,
        "payload" text NOT NULL,
        "status" varchar NOT NULL DEFAULT 'pending',
        "attempt" integer NOT NULL DEFAULT 1,
        "maxAttempts" integer NOT NULL DEFAULT 5,
        "nextRetryAt" datetime,
        "lastStatusCode" integer,
        "lastError" text,
        "lastAttemptAt" datetime,
        "createdAt" datetime DEFAULT now(),
        "updatedAt" datetime DEFAULT now(),
        CONSTRAINT "FK_webhook_delivery_webhook" FOREIGN KEY ("webhookId") REFERENCES "webhooks"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_webhook_delivery_status_retry" ON "webhook_delivery" ("status", "nextRetryAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_webhook_delivery_status_retry"`,
    );
    await queryRunner.query(`DROP TABLE "webhook_delivery"`);
  }
}
