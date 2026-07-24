import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEscrowQueryPerformanceIndexes1780700000000 implements MigrationInterface {
  name = 'AddEscrowQueryPerformanceIndexes1780700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_escrows_status" ON "escrows" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_escrows_creator_status" ON "escrows" ("creatorId", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_escrows_created_at" ON "escrows" ("createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_escrows_expires_at" ON "escrows" ("expiresAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_users_wallet_address" ON "users" ("walletAddress")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_escrow_events_escrow_id" ON "escrow_events" ("escrowId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_escrow_events_escrow_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_wallet_address"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_escrows_expires_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_escrows_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_escrows_creator_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_escrows_status"`);
  }
}
