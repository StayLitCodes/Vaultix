import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNonceExpiresAtToUser1782000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "nonceExpiresAt" datetime`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "nonceExpiresAt"`);
  }
}
