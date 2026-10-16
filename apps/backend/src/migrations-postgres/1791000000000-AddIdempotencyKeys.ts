import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIdempotencyKeys1791000000000 implements MigrationInterface {
  name = 'AddIdempotencyKeys1791000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "idempotency_keys" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "scope" character varying NOT NULL, "key" character varying NOT NULL, "requestHash" character varying NOT NULL, "responseStatus" integer, "responseBody" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_idempotency_keys_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_idempotency_user_scope_key" ON "idempotency_keys" ("userId", "scope", "key")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_idempotency_expires_at" ON "idempotency_keys" ("expiresAt")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "idempotency_keys"`);
  }
}
