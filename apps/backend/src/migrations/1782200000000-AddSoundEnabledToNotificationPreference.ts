import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSoundEnabledToNotificationPreference1782200000000
  implements MigrationInterface
{
  name = 'AddSoundEnabledToNotificationPreference1782200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_preference" ADD COLUMN "soundEnabled" boolean NOT NULL DEFAULT (1)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_preference" DROP COLUMN "soundEnabled"`,
    );
  }
}
