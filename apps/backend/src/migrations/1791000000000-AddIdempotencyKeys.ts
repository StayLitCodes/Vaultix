import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIdempotencyKeys1791000000000 implements MigrationInterface {
  name = 'AddIdempotencyKeys1791000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "idempotency_keys" ("id" varchar PRIMARY KEY NOT NULL, "userId" varchar NOT NULL, "scope" varchar NOT NULL, "key" varchar NOT NULL, "requestHash" varchar NOT NULL, "responseStatus" integer, "responseBody" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "expiresAt" datetime NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_idempotency_user_scope_key" ON "idempotency_keys" ("userId", "scope", "key")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_idempotency_expires_at" ON "idempotency_keys" ("expiresAt")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "idempotency_keys"`);
  }
}
