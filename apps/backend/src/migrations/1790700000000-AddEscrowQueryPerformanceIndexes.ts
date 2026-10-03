import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEscrowQueryPerformanceIndexes1790700000000 implements MigrationInterface {
  name = 'AddEscrowQueryPerformanceIndexes1790700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_escrow_parties_user_role" ON "escrow_parties" ("userId", "role")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_escrow_events_escrow_id" ON "escrow_events" ("escrowId")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "idx_escrow_events_escrow_id"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "idx_escrow_parties_user_role"',
    );
  }
}
