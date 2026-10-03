import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Binds email verification tokens to the address they were issued for.
 *
 * Existing rows only carry userId, so the address they targeted cannot be
 * recovered reliably (the user may have changed email since). Outstanding
 * legacy tokens are therefore invalidated; users can request a new one.
 */
export class BindEmailVerificationToAddress1782300000000 implements MigrationInterface {
  name = 'BindEmailVerificationToAddress1782300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "email_verifications" ADD COLUMN "email" varchar(255)`,
    );
    await queryRunner.query(
      `UPDATE "email_verifications" SET "isUsed" = 1 WHERE "isUsed" = 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "email_verifications" DROP COLUMN "email"`,
    );
  }
}
