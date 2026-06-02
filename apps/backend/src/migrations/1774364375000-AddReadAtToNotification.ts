import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReadAtToNotification1774364375000 implements MigrationInterface {
  name = 'AddReadAtToNotification1774364375000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification" ADD COLUMN "readAt" datetime`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification" ADD COLUMN "escrowId" varchar`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification" DROP COLUMN "escrowId"`,
    );
    await queryRunner.query(`ALTER TABLE "notification" DROP COLUMN "readAt"`);
  }
}
