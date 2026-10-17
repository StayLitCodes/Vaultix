import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssetRegistryMetadata1790900000000 implements MigrationInterface {
  name = 'AddAssetRegistryMetadata1790900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "allowed_assets" ADD COLUMN "homeDomain" character varying(255)',
    );
    await queryRunner.query(
      'ALTER TABLE "allowed_assets" ADD COLUMN "assetType" character varying(32)',
    );
    await queryRunner.query(
      'ALTER TABLE "allowed_assets" ADD COLUMN "numAccounts" integer',
    );
    await queryRunner.query(
      'ALTER TABLE "allowed_assets" ADD COLUMN "lastValidatedAt" TIMESTAMP',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_allowed_assets_code_issuer" ON "allowed_assets" ("code", "issuer") WHERE "issuer" IS NOT NULL',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_allowed_assets_native_code" ON "allowed_assets" ("code") WHERE "issuer" IS NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "UQ_allowed_assets_native_code"');
    await queryRunner.query('DROP INDEX "UQ_allowed_assets_code_issuer"');
    await queryRunner.query(
      'ALTER TABLE "allowed_assets" DROP COLUMN "lastValidatedAt"',
    );
    await queryRunner.query(
      'ALTER TABLE "allowed_assets" DROP COLUMN "numAccounts"',
    );
    await queryRunner.query(
      'ALTER TABLE "allowed_assets" DROP COLUMN "assetType"',
    );
    await queryRunner.query(
      'ALTER TABLE "allowed_assets" DROP COLUMN "homeDomain"',
    );
  }
}
