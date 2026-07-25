import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogsTable1800000000000 implements MigrationInterface {
  name = 'CreateAuditLogsTable1800000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "audit_logs" (
        "id" varchar PRIMARY KEY NOT NULL,
        "entityType" varchar(64) NOT NULL,
        "entityId" varchar(128) NOT NULL,
        "action" varchar(128) NOT NULL,
        "actorId" varchar(128),
        "actorRole" varchar(64),
        "previousState" text,
        "newState" text,
        "ipAddress" varchar(64),
        "userAgent" varchar(512),
        "metadata" text,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now'))
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_audit_entity_id" ON "audit_logs" ("entityId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_action" ON "audit_logs" ("action")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_created_at" ON "audit_logs" ("createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_entity_action_created" ON "audit_logs" ("entityType", "entityId", "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_audit_entity_action_created"`);
    await queryRunner.query(`DROP INDEX "idx_audit_created_at"`);
    await queryRunner.query(`DROP INDEX "idx_audit_action"`);
    await queryRunner.query(`DROP INDEX "idx_audit_entity_id"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
  }
}
