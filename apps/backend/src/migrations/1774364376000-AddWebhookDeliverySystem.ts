import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWebhookDeliverySystem1774364376000 implements MigrationInterface {
  name = 'AddWebhookDeliverySystem1774364376000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "webhooks" ADD COLUMN "failureCount" integer NOT NULL DEFAULT (0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhooks" ADD COLUMN "lastTriggeredAt" datetime`,
    );

    await queryRunner.query(`
      CREATE TABLE "webhook_deliveries" (
        "id" varchar PRIMARY KEY NOT NULL,
        "event" varchar NOT NULL,
        "payload" text,
        "responseStatus" integer,
        "attemptCount" integer NOT NULL DEFAULT (0),
        "nextRetryAt" datetime,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
        "webhookId" varchar,
        CONSTRAINT "FK_webhook_delivery_webhook" FOREIGN KEY ("webhookId") REFERENCES "webhooks" ("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "webhook_deliveries"`);
    await queryRunner.query(`ALTER TABLE "webhooks" DROP COLUMN "lastTriggeredAt"`);
    await queryRunner.query(`ALTER TABLE "webhooks" DROP COLUMN "failureCount"`);
  }
}
