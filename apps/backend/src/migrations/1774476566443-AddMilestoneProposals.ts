import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMilestoneProposals1774476566443 implements MigrationInterface {
  name = 'AddMilestoneProposals1774476566443';

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
      `CREATE TABLE "temporary_escrow_conditions" ("id" varchar PRIMARY KEY NOT NULL, "escrowId" varchar NOT NULL, "description" text NOT NULL, "type" varchar NOT NULL DEFAULT ('manual'), "isMet" boolean NOT NULL DEFAULT (0), "metAt" datetime, "metByUserId" varchar, "metadata" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isFulfilled" boolean NOT NULL DEFAULT (0), "fulfilledAt" datetime, "fulfilledByUserId" varchar, "fulfillmentNotes" text, "fulfillmentEvidence" text, "amount" decimal(18,7), "proposedAmount" decimal(18,7), "proposedDescription" text, "proposedByUserId" varchar, CONSTRAINT "FK_88456ecac834c788fc912233e05" FOREIGN KEY ("escrowId") REFERENCES "escrows" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_escrow_conditions"("id", "escrowId", "description", "type", "isMet", "metAt", "metByUserId", "metadata", "createdAt", "updatedAt", "isFulfilled", "fulfilledAt", "fulfilledByUserId", "fulfillmentNotes", "fulfillmentEvidence") SELECT "id", "escrowId", "description", "type", "isMet", "metAt", "metByUserId", "metadata", "createdAt", "updatedAt", "isFulfilled", "fulfilledAt", "fulfilledByUserId", "fulfillmentNotes", "fulfillmentEvidence" FROM "escrow_conditions"`,
    );
    await queryRunner.query(`DROP TABLE "escrow_conditions"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_escrow_conditions" RENAME TO "escrow_conditions"`,
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
      `CREATE TABLE "temporary_notification" ("id" varchar PRIMARY KEY NOT NULL, "userId" varchar NOT NULL, "eventType" varchar CHECK( "eventType" IN ('ESCROW_CREATED','ESCROW_FUNDED','MILESTONE_RELEASED','ESCROW_COMPLETED','ESCROW_CANCELLED','DISPUTE_RAISED','DISPUTE_RESOLVED','ESCROW_EXPIRED','CONDITION_FULFILLED','CONDITION_CONFIRMED','EXPIRATION_WARNING') ) NOT NULL, "payload" text NOT NULL, "status" varchar CHECK( "status" IN ('pending','sent','failed') ) NOT NULL DEFAULT ('pending'), "retryCount" integer NOT NULL DEFAULT (0), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_notification"("id", "userId", "eventType", "payload", "status", "retryCount", "createdAt", "updatedAt") SELECT "id", "userId", "eventType", "payload", "status", "retryCount", "createdAt", "updatedAt" FROM "notification"`,
    );
    await queryRunner.query(`DROP TABLE "notification"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_notification" RENAME TO "notification"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification" RENAME TO "temporary_notification"`,
    );
    await queryRunner.query(
      `CREATE TABLE "notification" ("id" varchar PRIMARY KEY NOT NULL, "userId" varchar NOT NULL, "eventType" varchar CHECK( "eventType" IN ('ESCROW_CREATED','ESCROW_FUNDED','MILESTONE_RELEASED','ESCROW_COMPLETED','ESCROW_CANCELLED','DISPUTE_RAISED','DISPUTE_RESOLVED','ESCROW_EXPIRED') ) NOT NULL, "payload" text NOT NULL, "status" varchar CHECK( "status" IN ('pending','sent','failed') ) NOT NULL DEFAULT ('pending'), "retryCount" integer NOT NULL DEFAULT (0), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `INSERT INTO "notification"("id", "userId", "eventType", "payload", "status", "retryCount", "createdAt", "updatedAt") SELECT "id", "userId", "eventType", "payload", "status", "retryCount", "createdAt", "updatedAt" FROM "temporary_notification"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_notification"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME TO "temporary_users"`);
    await queryRunner.query(
      `CREATE TABLE "users" ("id" varchar PRIMARY KEY NOT NULL, "walletAddress" varchar NOT NULL, "nonce" varchar, "isActive" boolean NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "role" varchar CHECK( "role" IN ('USER','ADMIN','SUPER_ADMIN') ) NOT NULL DEFAULT ('USER'), CONSTRAINT "UQ_fc71cd6fb73f95244b23e2ef113" UNIQUE ("walletAddress"))`,
    );
    await queryRunner.query(
      `INSERT INTO "users"("id", "walletAddress", "nonce", "isActive", "createdAt", "updatedAt", "role") SELECT "id", "walletAddress", "nonce", "isActive", "createdAt", "updatedAt", "role" FROM "temporary_users"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_users"`);
    await queryRunner.query(
      `ALTER TABLE "escrow_conditions" RENAME TO "temporary_escrow_conditions"`,
    );
    await queryRunner.query(
      `CREATE TABLE "escrow_conditions" ("id" varchar PRIMARY KEY NOT NULL, "escrowId" varchar NOT NULL, "description" text NOT NULL, "type" varchar NOT NULL DEFAULT ('manual'), "isMet" boolean NOT NULL DEFAULT (0), "metAt" datetime, "metByUserId" varchar, "metadata" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isFulfilled" boolean NOT NULL DEFAULT (0), "fulfilledAt" datetime, "fulfilledByUserId" varchar, "fulfillmentNotes" text, "fulfillmentEvidence" text, CONSTRAINT "FK_88456ecac834c788fc912233e05" FOREIGN KEY ("escrowId") REFERENCES "escrows" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "escrow_conditions"("id", "escrowId", "description", "type", "isMet", "metAt", "metByUserId", "metadata", "createdAt", "updatedAt", "isFulfilled", "fulfilledAt", "fulfilledByUserId", "fulfillmentNotes", "fulfillmentEvidence") SELECT "id", "escrowId", "description", "type", "isMet", "metAt", "metByUserId", "metadata", "createdAt", "updatedAt", "isFulfilled", "fulfilledAt", "fulfilledByUserId", "fulfillmentNotes", "fulfillmentEvidence" FROM "temporary_escrow_conditions"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_escrow_conditions"`);
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
