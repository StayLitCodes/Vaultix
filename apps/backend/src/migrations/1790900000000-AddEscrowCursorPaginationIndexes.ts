import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEscrowCursorPaginationIndexes1790900000000
  implements MigrationInterface
{
  name = 'AddEscrowCursorPaginationIndexes1790900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_escrows_created_at_id" ON "escrows" ("createdAt", "id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_escrows_status_created_at_id" ON "escrows" ("status", "createdAt", "id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_escrows_asset_created_at" ON "escrows" ("asset_code", "asset_issuer", "createdAt")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "idx_escrows_asset_created_at"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "idx_escrows_status_created_at_id"',
    );
    await queryRunner.query('DROP INDEX IF EXISTS "idx_escrows_created_at_id"');
  }
}
