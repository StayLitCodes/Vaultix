import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the `dispute_evidence` table for structured local-file evidence storage.
 *
 * This is separate from the legacy `evidenceFiles` JSON column on `disputes`
 * (added by migration 1780500000000) which remains for IPFS metadata.
 */
export class CreateDisputeEvidenceTable1780700000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dispute_evidence" (
        "id"               varchar(36)  NOT NULL PRIMARY KEY,
        "disputeId"        varchar(36)  NOT NULL,
        "uploadedById"     varchar(36)  NOT NULL,
        "storedFilename"   varchar(64)  NOT NULL,
        "originalFilename" varchar(255) NOT NULL,
        "mimeType"         varchar(128) NOT NULL,
        "size"             integer      NOT NULL,
        "storagePath"      varchar(512) NOT NULL,
        "thumbnailPath"    varchar(512),
        "checksum"         varchar(64)  NOT NULL,
        "scanStatus"       varchar(32)  NOT NULL DEFAULT 'pending_scan',
        "scanResult"       text,
        "scannedAt"        datetime,
        "deleted"          boolean      NOT NULL DEFAULT 0,
        "deletedById"      varchar(36),
        "deletedAt"        datetime,
        "createdAt"        datetime     NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY ("disputeId")    REFERENCES "disputes"("id") ON DELETE CASCADE,
        FOREIGN KEY ("uploadedById") REFERENCES "users"("id")    ON DELETE SET NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dispute_evidence_disputeId"
         ON "dispute_evidence" ("disputeId")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dispute_evidence_uploadedById"
         ON "dispute_evidence" ("uploadedById")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_dispute_evidence_uploadedById"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_dispute_evidence_disputeId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "dispute_evidence"`);
  }
}
