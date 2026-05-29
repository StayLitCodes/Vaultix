import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisputeDeadlineToEscrow1774364376000 implements MigrationInterface {
  name = 'AddDisputeDeadlineToEscrow1774364376000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "escrows" ADD COLUMN "disputeDeadline" datetime`);
    await queryRunner.query(`CREATE INDEX "idx_escrows_dispute_deadline" ON "escrows" ("disputeDeadline")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_escrows_dispute_deadline"`);
    await queryRunner.query(`ALTER TABLE "escrows" DROP COLUMN "disputeDeadline"`);
  }
}
