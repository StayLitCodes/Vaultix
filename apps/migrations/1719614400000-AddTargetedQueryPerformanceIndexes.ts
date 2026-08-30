import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTargetedQueryPerformanceIndexes1719614400000 implements MigrationInterface {
  name = 'AddTargetedQueryPerformanceIndexes1719614400000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Escrow Table Index Migrations
    await queryRunner.query(`CREATE INDEX "IDX_escrows_status" ON "escrows" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_escrows_buyerId" ON "escrows" ("buyerId")`);
    await queryRunner.query(`CREATE INDEX "IDX_escrows_sellerId" ON "escrows" ("sellerId")`);
    await queryRunner.query(`CREATE INDEX "IDX_escrows_createdAt" ON "escrows" ("createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_escrows_deadline" ON "escrows" ("deadline")`);
    await queryRunner.query(`CREATE INDEX "IDX_escrows_status_createdAt" ON "escrows" ("status", "createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_escrows_buyerId_status" ON "escrows" ("buyerId", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_escrows_sellerId_status" ON "escrows" ("sellerId", "status")`);

    // 2. Condition Table Index Migrations
    await queryRunner.query(`CREATE INDEX "IDX_conditions_escrowId" ON "conditions" ("escrowId")`);

    // 3. Dispute Table Index Migrations
    await queryRunner.query(`CREATE INDEX "IDX_disputes_escrowId" ON "disputes" ("escrowId")`);
    await queryRunner.query(`CREATE INDEX "IDX_disputes_status" ON "disputes" ("status")`);

    // 4. Notification Table Index Migrations
    await queryRunner.query(`CREATE INDEX "IDX_notifications_userId_isRead" ON "notifications" ("userId", "isRead")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop Notification Indices
    await queryRunner.query(`DROP INDEX "IDX_notifications_userId_isRead"`);

    // Drop Dispute Indices
    await queryRunner.query(`DROP INDEX "IDX_disputes_status"`);
    await queryRunner.query(`DROP INDEX "IDX_disputes_escrowId"`);

    // Drop Condition Indices
    await queryRunner.query(`DROP INDEX "IDX_conditions_escrowId"`);

    // Drop Escrow Indices
    await queryRunner.query(`DROP INDEX "IDX_escrows_sellerId_status"`);
    await queryRunner.query(`DROP INDEX "IDX_escrows_buyerId_status"`);
    await queryRunner.query(`DROP INDEX "IDX_escrows_status_createdAt"`);
    await queryRunner.query(`DROP INDEX "IDX_escrows_deadline"`);
    await queryRunner.query(`DROP INDEX "IDX_escrows_createdAt"`);
    await queryRunner.query(`DROP INDEX "IDX_escrows_sellerId"`);
    await queryRunner.query(`DROP INDEX "IDX_escrows_buyerId"`);
    await queryRunner.query(`DROP INDEX "IDX_escrows_status"`);
  }
}