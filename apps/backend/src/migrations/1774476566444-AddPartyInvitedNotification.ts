import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPartyInvitedNotification1774476566444 implements MigrationInterface {
  name = 'AddPartyInvitedNotification1774476566444';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasReadAt = await queryRunner.hasColumn('notification', 'readAt');
    const hasEscrowId = await queryRunner.hasColumn('notification', 'escrowId');

    await queryRunner.query(
      `CREATE TABLE "temporary_notification" ("id" varchar PRIMARY KEY NOT NULL, "userId" varchar NOT NULL, "eventType" varchar CHECK( "eventType" IN ('ESCROW_CREATED','ESCROW_FUNDED','MILESTONE_RELEASED','ESCROW_COMPLETED','ESCROW_CANCELLED','DISPUTE_RAISED','DISPUTE_RESOLVED','ESCROW_EXPIRED','CONDITION_FULFILLED','CONDITION_CONFIRMED','EXPIRATION_WARNING','PARTY_INVITED') ) NOT NULL, "payload" text NOT NULL, "status" varchar CHECK( "status" IN ('pending','sent','failed') ) NOT NULL DEFAULT ('pending'), "retryCount" integer NOT NULL DEFAULT (0), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "readAt" datetime, "escrowId" varchar)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_notification"("id", "userId", "eventType", "payload", "status", "retryCount", "createdAt", "updatedAt", "readAt", "escrowId") SELECT "id", "userId", "eventType", "payload", "status", "retryCount", "createdAt", "updatedAt", ${hasReadAt ? '"readAt"' : 'NULL'}, ${hasEscrowId ? '"escrowId"' : 'NULL'} FROM "notification"`,
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
      `CREATE TABLE "notification" ("id" varchar PRIMARY KEY NOT NULL, "userId" varchar NOT NULL, "eventType" varchar CHECK( "eventType" IN ('ESCROW_CREATED','ESCROW_FUNDED','MILESTONE_RELEASED','ESCROW_COMPLETED','ESCROW_CANCELLED','DISPUTE_RAISED','DISPUTE_RESOLVED','ESCROW_EXPIRED','CONDITION_FULFILLED','CONDITION_CONFIRMED','EXPIRATION_WARNING') ) NOT NULL, "payload" text NOT NULL, "status" varchar CHECK( "status" IN ('pending','sent','failed') ) NOT NULL DEFAULT ('pending'), "retryCount" integer NOT NULL DEFAULT (0), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "readAt" datetime, "escrowId" varchar)`,
    );
    await queryRunner.query(
      `INSERT INTO "notification"("id", "userId", "eventType", "payload", "status", "retryCount", "createdAt", "updatedAt", "readAt", "escrowId") SELECT "id", "userId", "eventType", "payload", "status", "retryCount", "createdAt", "updatedAt", "readAt", "escrowId" FROM "temporary_notification" WHERE "eventType" != 'PARTY_INVITED'`,
    );
    await queryRunner.query(`DROP TABLE "temporary_notification"`);
  }
}
