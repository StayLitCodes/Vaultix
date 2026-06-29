import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEvidenceFilesToDispute1780500000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "disputes" ADD COLUMN "evidenceFiles" text DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "disputes" DROP COLUMN "evidenceFiles"`,
    );
  }
}
