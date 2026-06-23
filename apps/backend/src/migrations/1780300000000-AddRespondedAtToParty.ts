import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRespondedAtToParty1780300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "escrow_parties" ADD COLUMN "respondedAt" datetime`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "escrow_parties" DROP COLUMN "respondedAt"`,
    );
  }
}
