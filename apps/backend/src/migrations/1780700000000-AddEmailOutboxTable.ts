import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailOutboxTable1780700000000 implements MigrationInterface {
  name = 'AddEmailOutboxTable1780700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "email_outbox" (
        "id" varchar PRIMARY KEY,
        "to" varchar NOT NULL,
        "subject" varchar NOT NULL,
        "html" text NOT NULL,
        "text" text,
        "status" varchar NOT NULL DEFAULT 'pending',
        "attempts" integer NOT NULL DEFAULT 0,
        "nextRetryAt" datetime,
        "lastError" text,
        "sentAt" datetime,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_email_outbox_status_retry" ON "email_outbox" ("status", "nextRetryAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_email_outbox_status_retry"`,
    );
    await queryRunner.query(`DROP TABLE "email_outbox"`);
  }
}
