import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEscrowEventStore1775781600000 implements MigrationInterface {
  name = 'AddEscrowEventStore1775781600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "escrow_event_store" (
        "id" varchar PRIMARY KEY NOT NULL,
        "escrow_id" varchar NOT NULL,
        "event_type" varchar NOT NULL,
        "actor_id" varchar,
        "payload" text,
        "tx_hash" varchar,
        "ip_address" varchar,
        "idempotency_key" varchar,
        "event_version" integer NOT NULL DEFAULT (1),
        "created_at" datetime NOT NULL DEFAULT (datetime('now')),
        "cursor" bigint NOT NULL,
        CONSTRAINT "UQ_event_store_idempotency" UNIQUE ("idempotency_key")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_event_store_escrow_id" ON "escrow_event_store" ("escrow_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_event_store_type" ON "escrow_event_store" ("event_type")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_event_store_actor" ON "escrow_event_store" ("actor_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_event_store_created_at" ON "escrow_event_store" ("created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_event_store_cursor" ON "escrow_event_store" ("cursor")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_event_store_cursor"`);
    await queryRunner.query(`DROP INDEX "idx_event_store_created_at"`);
    await queryRunner.query(`DROP INDEX "idx_event_store_actor"`);
    await queryRunner.query(`DROP INDEX "idx_event_store_type"`);
    await queryRunner.query(`DROP INDEX "idx_event_store_escrow_id"`);
    await queryRunner.query(`DROP TABLE "escrow_event_store"`);
  }
}
