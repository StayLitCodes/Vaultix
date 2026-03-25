import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1774364374006 implements MigrationInterface {
  name = 'InitialMigration1774364374006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "temporary_users" ("id" varchar PRIMARY KEY NOT NULL, "walletAddress" varchar NOT NULL, "nonce" varchar, "isActive" boolean NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "role" varchar CHECK( "role" IN ('USER','ADMIN','SUPER_ADMIN') ) NOT NULL DEFAULT ('USER'), CONSTRAINT "UQ_fc71cd6fb73f95244b23e2ef113" UNIQUE ("walletAddress"))`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_users"("id", "walletAddress", "nonce", "isActive", "createdAt", "updatedAt", "role") SELECT "id", "walletAddress", "nonce", "isActive", "createdAt", "updatedAt", "role" FROM "users"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`ALTER TABLE "temporary_users" RENAME TO "users"`);
    await queryRunner.query(
      `CREATE TABLE "disputes" ("id" varchar PRIMARY KEY NOT NULL, "escrowId" varchar NOT NULL, "filedByUserId" varchar NOT NULL, "reason" text NOT NULL, "evidence" text, "status" varchar NOT NULL DEFAULT ('open'), "resolvedByUserId" varchar, "resolutionNotes" text, "sellerPercent" decimal(5,2), "buyerPercent" decimal(5,2), "outcome" varchar, "resolvedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "REL_05cc0a36ac22b4dc8a82211d2e" UNIQUE ("escrowId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "notification" ("id" varchar PRIMARY KEY NOT NULL, "userId" varchar NOT NULL, "eventType" varchar CHECK( "eventType" IN ('ESCROW_CREATED','ESCROW_FUNDED','MILESTONE_RELEASED','ESCROW_COMPLETED','ESCROW_CANCELLED','DISPUTE_RAISED','DISPUTE_RESOLVED','ESCROW_EXPIRED') ) NOT NULL, "payload" text NOT NULL, "status" varchar CHECK( "status" IN ('pending','sent','failed') ) NOT NULL DEFAULT ('pending'), "retryCount" integer NOT NULL DEFAULT (0), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "notification_preference" ("id" varchar PRIMARY KEY NOT NULL, "userId" varchar NOT NULL, "channel" varchar CHECK( "channel" IN ('email','webhook') ) NOT NULL, "enabled" boolean NOT NULL DEFAULT (1), "eventTypes" text NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "api_key" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar NOT NULL, "keyHash" varchar NOT NULL, "ownerUserId" varchar NOT NULL, "active" boolean NOT NULL DEFAULT (1), "revokedAt" datetime, "rateLimitPerMinute" integer NOT NULL DEFAULT (60), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_4aacb7c1641a74534c8a96c4dc9" UNIQUE ("keyHash"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "admin_audit_log" ("id" varchar PRIMARY KEY NOT NULL, "actorId" varchar(64) NOT NULL, "actionType" varchar(64) NOT NULL, "resourceType" varchar(64) NOT NULL, "resourceId" varchar(128), "metadata" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "webhooks" ("id" varchar PRIMARY KEY NOT NULL, "url" varchar NOT NULL, "secret" varchar NOT NULL, "events" text NOT NULL, "isActive" boolean NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "userId" varchar NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE TABLE "stellar_events" ("id" varchar PRIMARY KEY NOT NULL, "txHash" varchar(64) NOT NULL, "eventIndex" integer NOT NULL, "eventType" varchar CHECK( "eventType" IN ('ESCROW_CREATED','ESCROW_FUNDED','MILESTONE_RELEASED','ESCROW_COMPLETED','ESCROW_CANCELLED','DISPUTE_CREATED','DISPUTE_RESOLVED') ) NOT NULL, "escrowId" varchar, "ledger" integer NOT NULL, "timestamp" datetime NOT NULL, "rawPayload" text NOT NULL, "extractedFields" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "amount" decimal(18,7), "asset" varchar, "milestoneIndex" integer, "fromAddress" varchar, "toAddress" varchar, "reason" text, CONSTRAINT "UQ_c6a70c31de4c4d3b23e6229c515" UNIQUE ("txHash", "eventIndex"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_33bcf3b402d8757d22c1cc1ad3" ON "stellar_events" ("txHash") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_56e937f62e6766e06118ae9b6c" ON "stellar_events" ("eventType") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ad3aa47d032fd93d4f307d30ab" ON "stellar_events" ("ledger") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f8d00fffa3b5110edf867481dd" ON "stellar_events" ("timestamp") `,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_escrow_conditions" ("id" varchar PRIMARY KEY NOT NULL, "escrowId" varchar NOT NULL, "description" text NOT NULL, "type" varchar NOT NULL DEFAULT ('manual'), "isMet" boolean NOT NULL DEFAULT (0), "metAt" datetime, "metByUserId" varchar, "metadata" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isFulfilled" boolean NOT NULL DEFAULT (0), "fulfilledAt" datetime, "fulfilledByUserId" varchar, "fulfillmentNotes" text, "fulfillmentEvidence" text, CONSTRAINT "FK_88456ecac834c788fc912233e05" FOREIGN KEY ("escrowId") REFERENCES "escrows" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_escrow_conditions"("id", "escrowId", "description", "type", "isMet", "metAt", "metByUserId", "metadata", "createdAt", "updatedAt") SELECT "id", "escrowId", "description", "type", "isMet", "metAt", "metByUserId", "metadata", "createdAt", "updatedAt" FROM "escrow_conditions"`,
    );
    await queryRunner.query(`DROP TABLE "escrow_conditions"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_escrow_conditions" RENAME TO "escrow_conditions"`,
    );
    await queryRunner.query(`DROP INDEX "idx_escrows_creator"`);
    await queryRunner.query(`DROP INDEX "idx_escrows_status"`);
    await queryRunner.query(`DROP INDEX "idx_escrows_asset"`);
    await queryRunner.query(`DROP INDEX "idx_escrows_created_at"`);
    await queryRunner.query(`DROP INDEX "idx_escrows_expires_at"`);
    await queryRunner.query(`DROP INDEX "idx_escrows_creator_status_created"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_escrows" ("id" varchar PRIMARY KEY NOT NULL, "title" varchar NOT NULL, "description" text, "amount" decimal(18,7) NOT NULL, "asset" varchar NOT NULL DEFAULT ('XLM'), "status" varchar NOT NULL DEFAULT ('pending'), "type" varchar NOT NULL DEFAULT ('standard'), "creatorId" varchar NOT NULL, "expiresAt" datetime, "isActive" boolean NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "releaseTransactionHash" varchar, "isReleased" boolean NOT NULL DEFAULT (0), "expirationNotifiedAt" datetime, "stellarTxHash" varchar, "fundedAt" datetime, CONSTRAINT "FK_b483b9f73c28476240bbc993d0b" FOREIGN KEY ("creatorId") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_escrows"("id", "title", "description", "amount", "asset", "status", "type", "creatorId", "expiresAt", "isActive", "createdAt", "updatedAt", "releaseTransactionHash", "isReleased", "expirationNotifiedAt") SELECT "id", "title", "description", "amount", "asset", "status", "type", "creatorId", "expiresAt", "isActive", "createdAt", "updatedAt", "releaseTransactionHash", "isReleased", "expirationNotifiedAt" FROM "escrows"`,
    );
    await queryRunner.query(`DROP TABLE "escrows"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_escrows" RENAME TO "escrows"`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_escrows_creator" ON "escrows" ("creatorId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_escrows_status" ON "escrows" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_escrows_asset" ON "escrows" ("asset") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_escrows_created_at" ON "escrows" ("createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_escrows_expires_at" ON "escrows" ("expiresAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_escrows_creator_status_created" ON "escrows" ("creatorId", "status", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_users" ("id" varchar PRIMARY KEY NOT NULL, "walletAddress" varchar NOT NULL, "nonce" varchar, "isActive" boolean NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "role" varchar CHECK( "role" IN ('USER','ADMIN','SUPER_ADMIN') ) NOT NULL DEFAULT ('USER'), CONSTRAINT "UQ_fc71cd6fb73f95244b23e2ef113" UNIQUE ("walletAddress"))`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_users"("id", "walletAddress", "nonce", "isActive", "createdAt", "updatedAt", "role") SELECT "id", "walletAddress", "nonce", "isActive", "createdAt", "updatedAt", "role" FROM "users"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`ALTER TABLE "temporary_users" RENAME TO "users"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_disputes" ("id" varchar PRIMARY KEY NOT NULL, "escrowId" varchar NOT NULL, "filedByUserId" varchar NOT NULL, "reason" text NOT NULL, "evidence" text, "status" varchar NOT NULL DEFAULT ('open'), "resolvedByUserId" varchar, "resolutionNotes" text, "sellerPercent" decimal(5,2), "buyerPercent" decimal(5,2), "outcome" varchar, "resolvedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "REL_05cc0a36ac22b4dc8a82211d2e" UNIQUE ("escrowId"), CONSTRAINT "FK_05cc0a36ac22b4dc8a82211d2ee" FOREIGN KEY ("escrowId") REFERENCES "escrows" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_23f126d4aaaa9d67243895b784b" FOREIGN KEY ("filedByUserId") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_a2215614b176b851d3e431de9b9" FOREIGN KEY ("resolvedByUserId") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_disputes"("id", "escrowId", "filedByUserId", "reason", "evidence", "status", "resolvedByUserId", "resolutionNotes", "sellerPercent", "buyerPercent", "outcome", "resolvedAt", "createdAt", "updatedAt") SELECT "id", "escrowId", "filedByUserId", "reason", "evidence", "status", "resolvedByUserId", "resolutionNotes", "sellerPercent", "buyerPercent", "outcome", "resolvedAt", "createdAt", "updatedAt" FROM "disputes"`,
    );
    await queryRunner.query(`DROP TABLE "disputes"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_disputes" RENAME TO "disputes"`,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_webhooks" ("id" varchar PRIMARY KEY NOT NULL, "url" varchar NOT NULL, "secret" varchar NOT NULL, "events" text NOT NULL, "isActive" boolean NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "userId" varchar NOT NULL, CONSTRAINT "FK_7dbbb3fa9d7ccab4925a67af414" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_webhooks"("id", "url", "secret", "events", "isActive", "createdAt", "updatedAt", "userId") SELECT "id", "url", "secret", "events", "isActive", "createdAt", "updatedAt", "userId" FROM "webhooks"`,
    );
    await queryRunner.query(`DROP TABLE "webhooks"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_webhooks" RENAME TO "webhooks"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "webhooks" RENAME TO "temporary_webhooks"`,
    );
    await queryRunner.query(
      `CREATE TABLE "webhooks" ("id" varchar PRIMARY KEY NOT NULL, "url" varchar NOT NULL, "secret" varchar NOT NULL, "events" text NOT NULL, "isActive" boolean NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "userId" varchar NOT NULL)`,
    );
    await queryRunner.query(
      `INSERT INTO "webhooks"("id", "url", "secret", "events", "isActive", "createdAt", "updatedAt", "userId") SELECT "id", "url", "secret", "events", "isActive", "createdAt", "updatedAt", "userId" FROM "temporary_webhooks"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_webhooks"`);
    await queryRunner.query(
      `ALTER TABLE "disputes" RENAME TO "temporary_disputes"`,
    );
    await queryRunner.query(
      `CREATE TABLE "disputes" ("id" varchar PRIMARY KEY NOT NULL, "escrowId" varchar NOT NULL, "filedByUserId" varchar NOT NULL, "reason" text NOT NULL, "evidence" text, "status" varchar NOT NULL DEFAULT ('open'), "resolvedByUserId" varchar, "resolutionNotes" text, "sellerPercent" decimal(5,2), "buyerPercent" decimal(5,2), "outcome" varchar, "resolvedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "REL_05cc0a36ac22b4dc8a82211d2e" UNIQUE ("escrowId"))`,
    );
    await queryRunner.query(
      `INSERT INTO "disputes"("id", "escrowId", "filedByUserId", "reason", "evidence", "status", "resolvedByUserId", "resolutionNotes", "sellerPercent", "buyerPercent", "outcome", "resolvedAt", "createdAt", "updatedAt") SELECT "id", "escrowId", "filedByUserId", "reason", "evidence", "status", "resolvedByUserId", "resolutionNotes", "sellerPercent", "buyerPercent", "outcome", "resolvedAt", "createdAt", "updatedAt" FROM "temporary_disputes"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_disputes"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME TO "temporary_users"`);
    await queryRunner.query(
      `CREATE TABLE "users" ("id" varchar PRIMARY KEY NOT NULL, "walletAddress" varchar NOT NULL, "nonce" varchar, "isActive" boolean NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "role" varchar CHECK( "role" IN ('USER','ADMIN','SUPER_ADMIN') ) NOT NULL DEFAULT ('USER'), CONSTRAINT "UQ_fc71cd6fb73f95244b23e2ef113" UNIQUE ("walletAddress"))`,
    );
    await queryRunner.query(
      `INSERT INTO "users"("id", "walletAddress", "nonce", "isActive", "createdAt", "updatedAt", "role") SELECT "id", "walletAddress", "nonce", "isActive", "createdAt", "updatedAt", "role" FROM "temporary_users"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_users"`);
    await queryRunner.query(`DROP INDEX "idx_escrows_creator_status_created"`);
    await queryRunner.query(`DROP INDEX "idx_escrows_expires_at"`);
    await queryRunner.query(`DROP INDEX "idx_escrows_created_at"`);
    await queryRunner.query(`DROP INDEX "idx_escrows_asset"`);
    await queryRunner.query(`DROP INDEX "idx_escrows_status"`);
    await queryRunner.query(`DROP INDEX "idx_escrows_creator"`);
    await queryRunner.query(
      `ALTER TABLE "escrows" RENAME TO "temporary_escrows"`,
    );
    await queryRunner.query(
      `CREATE TABLE "escrows" ("id" varchar PRIMARY KEY NOT NULL, "title" varchar NOT NULL, "description" text, "amount" decimal(18,7) NOT NULL, "asset" varchar NOT NULL DEFAULT ('XLM'), "status" varchar NOT NULL DEFAULT ('pending'), "type" varchar NOT NULL DEFAULT ('standard'), "creatorId" varchar NOT NULL, "expiresAt" datetime, "isActive" boolean NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "releaseTransactionHash" varchar, "isReleased" boolean NOT NULL DEFAULT (0), "expirationNotifiedAt" datetime, CONSTRAINT "FK_b483b9f73c28476240bbc993d0b" FOREIGN KEY ("creatorId") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "escrows"("id", "title", "description", "amount", "asset", "status", "type", "creatorId", "expiresAt", "isActive", "createdAt", "updatedAt", "releaseTransactionHash", "isReleased", "expirationNotifiedAt") SELECT "id", "title", "description", "amount", "asset", "status", "type", "creatorId", "expiresAt", "isActive", "createdAt", "updatedAt", "releaseTransactionHash", "isReleased", "expirationNotifiedAt" FROM "temporary_escrows"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_escrows"`);
    await queryRunner.query(
      `CREATE INDEX "idx_escrows_creator_status_created" ON "escrows" ("creatorId", "status", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_escrows_expires_at" ON "escrows" ("expiresAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_escrows_created_at" ON "escrows" ("createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_escrows_asset" ON "escrows" ("asset") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_escrows_status" ON "escrows" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_escrows_creator" ON "escrows" ("creatorId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "escrow_conditions" RENAME TO "temporary_escrow_conditions"`,
    );
    await queryRunner.query(
      `CREATE TABLE "escrow_conditions" ("id" varchar PRIMARY KEY NOT NULL, "escrowId" varchar NOT NULL, "description" text NOT NULL, "type" varchar NOT NULL DEFAULT ('manual'), "isMet" boolean NOT NULL DEFAULT (0), "metAt" datetime, "metByUserId" varchar, "metadata" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_88456ecac834c788fc912233e05" FOREIGN KEY ("escrowId") REFERENCES "escrows" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "escrow_conditions"("id", "escrowId", "description", "type", "isMet", "metAt", "metByUserId", "metadata", "createdAt", "updatedAt") SELECT "id", "escrowId", "description", "type", "isMet", "metAt", "metByUserId", "metadata", "createdAt", "updatedAt" FROM "temporary_escrow_conditions"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_escrow_conditions"`);
    await queryRunner.query(`DROP INDEX "IDX_f8d00fffa3b5110edf867481dd"`);
    await queryRunner.query(`DROP INDEX "IDX_ad3aa47d032fd93d4f307d30ab"`);
    await queryRunner.query(`DROP INDEX "IDX_56e937f62e6766e06118ae9b6c"`);
    await queryRunner.query(`DROP INDEX "IDX_33bcf3b402d8757d22c1cc1ad3"`);
    await queryRunner.query(`DROP TABLE "stellar_events"`);
    await queryRunner.query(`DROP TABLE "webhooks"`);
    await queryRunner.query(`DROP TABLE "admin_audit_log"`);
    await queryRunner.query(`DROP TABLE "api_key"`);
    await queryRunner.query(`DROP TABLE "notification_preference"`);
    await queryRunner.query(`DROP TABLE "notification"`);
    await queryRunner.query(`DROP TABLE "disputes"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME TO "temporary_users"`);
    await queryRunner.query(
      `CREATE TABLE "users" ("id" varchar PRIMARY KEY NOT NULL, "walletAddress" varchar NOT NULL, "nonce" varchar, "isActive" boolean NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "role" varchar CHECK( "role" IN ('USER','ADMIN','SUPER_ADMIN') ) NOT NULL DEFAULT ('USER'), CONSTRAINT "UQ_fc71cd6fb73f95244b23e2ef113" UNIQUE ("walletAddress"))`,
    );
    await queryRunner.query(
      `INSERT INTO "users"("id", "walletAddress", "nonce", "isActive", "createdAt", "updatedAt", "role") SELECT "id", "walletAddress", "nonce", "isActive", "createdAt", "updatedAt", "role" FROM "temporary_users"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_users"`);
  }
}
