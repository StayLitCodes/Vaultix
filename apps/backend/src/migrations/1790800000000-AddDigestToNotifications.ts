import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDigestToNotifications1790800000000
  implements MigrationInterface
{
  name = 'AddDigestToNotifications1790800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_preference" ADD COLUMN "digestEnabled" boolean NOT NULL DEFAULT (0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification" ADD COLUMN "digestedAt" datetime`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification" DROP COLUMN "digestedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_preference" DROP COLUMN "digestEnabled"`,
    );
  }
}
