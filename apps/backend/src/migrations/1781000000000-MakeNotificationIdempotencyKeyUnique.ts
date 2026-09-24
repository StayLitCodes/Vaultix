import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeNotificationIdempotencyKeyUnique1781000000000
  implements MigrationInterface
{
  name = 'MakeNotificationIdempotencyKeyUnique1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_notification_idempotency_key"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_notification_idempotency_key" ON "notification" ("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_notification_idempotency_key"`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notification_idempotency_key" ON "notification" ("idempotencyKey")`,
    );
  }
}