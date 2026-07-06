import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateApiKeySchema1780500000000 implements MigrationInterface {
  name = 'UpdateApiKeySchema1780500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the old api_key table if it exists with the old schema
    await queryRunner.query(`DROP TABLE IF EXISTS "api_key"`);
    
    // Create the new api_key table with the correct schema
    await queryRunner.query(
      `CREATE TABLE "api_key" ("id" varchar PRIMARY KEY NOT NULL, "userId" varchar NOT NULL, "name" varchar NOT NULL, "keyHash" varchar NOT NULL, "keyPrefix" varchar NOT NULL, "scopes" text NOT NULL, "isActive" boolean NOT NULL DEFAULT (1), "lastUsedAt" datetime, "expiresAt" datetime, "revokedAt" datetime, "rateLimitPerMinute" integer NOT NULL DEFAULT (200), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_api_key_keyHash" UNIQUE ("keyHash"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "api_key"`);
  }
}
