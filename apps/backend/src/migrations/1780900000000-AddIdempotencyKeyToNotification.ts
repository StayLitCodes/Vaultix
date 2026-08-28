import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIdempotencyKeyToNotification1780900000000 implements MigrationInterface {
  name = 'AddIdempotencyKeyToNotification1780900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification" ADD COLUMN "idempotencyKey" varchar`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notification_idempotency_key" ON "notification" ("idempotencyKey")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_notification_idempotency_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification" DROP COLUMN "idempotencyKey"`,
    );
  }
}
