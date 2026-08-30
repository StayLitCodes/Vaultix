import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisputeEvidence1780400000000 implements MigrationInterface {
  name = 'AddDisputeEvidence1780400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "dispute_evidence" (
        "id" varchar PRIMARY KEY NOT NULL,
        "disputeId" varchar NOT NULL,
        "uploadedByUserId" varchar NOT NULL,
        "filename" varchar(255) NOT NULL,
        "originalName" varchar(255) NOT NULL,
        "mimeType" varchar(100) NOT NULL,
        "size" integer NOT NULL,
        "storagePath" varchar(500) NOT NULL,
        "thumbnailPath" varchar(500),
        "isDeleted" boolean NOT NULL DEFAULT (0),
        "deletedByUserId" varchar,
        "deletedAt" datetime,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
        CONSTRAINT "FK_dispute_evidence_dispute"
          FOREIGN KEY ("disputeId") REFERENCES "disputes" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_dispute_evidence_disputeId" ON "dispute_evidence" ("disputeId")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_dispute_evidence_uploadedBy" ON "dispute_evidence" ("uploadedByUserId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_dispute_evidence_uploadedBy"`);
    await queryRunner.query(`DROP INDEX "IDX_dispute_evidence_disputeId"`);
    await queryRunner.query(`DROP TABLE "dispute_evidence"`);
  }
}
