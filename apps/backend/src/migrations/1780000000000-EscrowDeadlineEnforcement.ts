import { MigrationInterface, QueryRunner } from 'typeorm';

export class EscrowDeadlineEnforcement1780000000000 implements MigrationInterface {
  name = 'EscrowDeadlineEnforcement1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "escrows" ADD COLUMN "expirationWarning24hSentAt" datetime`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrows" ADD COLUMN "expirationWarning1hSentAt" datetime`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrows" ADD COLUMN "refundTransactionHash" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrows" ADD COLUMN "releasedAmount" decimal(18,7) NOT NULL DEFAULT (0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrows" ADD COLUMN "refundRetryCount" integer NOT NULL DEFAULT (0)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "escrows" DROP COLUMN "refundRetryCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrows" DROP COLUMN "releasedAmount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrows" DROP COLUMN "refundTransactionHash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrows" DROP COLUMN "expirationWarning1hSentAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrows" DROP COLUMN "expirationWarning24hSentAt"`,
    );
  }
}
