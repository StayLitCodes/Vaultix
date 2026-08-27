import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIpfsMetadataToEscrows1780600000000 implements MigrationInterface {
  name = 'AddIpfsMetadataToEscrows1780600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "escrows" ADD "ipfs_cid" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrows" ADD "ipfs_metadata_hash" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrows" ADD "ipfs_version" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';
    if (isPostgres) {
      await queryRunner.query(
        `ALTER TABLE "escrows" DROP COLUMN "ipfs_version"`,
      );
      await queryRunner.query(
        `ALTER TABLE "escrows" DROP COLUMN "ipfs_metadata_hash"`,
      );
      await queryRunner.query(`ALTER TABLE "escrows" DROP COLUMN "ipfs_cid"`);
    } else {
      // SQLite drop column support can be tricky, but recent sqlite supports it, so we do it one by one:
      await queryRunner.query(
        `ALTER TABLE "escrows" DROP COLUMN "ipfs_version"`,
      );
      await queryRunner.query(
        `ALTER TABLE "escrows" DROP COLUMN "ipfs_metadata_hash"`,
      );
      await queryRunner.query(`ALTER TABLE "escrows" DROP COLUMN "ipfs_cid"`);
    }
  }
}
