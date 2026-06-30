import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIpfsMetadataToEscrows1780600000000 implements MigrationInterface {
  name = 'AddIpfsMetadataToEscrows1780600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "escrows" 
      ADD "ipfs_cid" character varying,
      ADD "ipfs_metadata_hash" character varying,
      ADD "ipfs_version" integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "escrows" 
      DROP COLUMN "ipfs_version",
      DROP COLUMN "ipfs_metadata_hash",
      DROP COLUMN "ipfs_cid"
    `);
  }
}
