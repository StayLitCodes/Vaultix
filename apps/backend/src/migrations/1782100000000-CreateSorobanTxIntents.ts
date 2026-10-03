import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSorobanTxIntents1782100000000 implements MigrationInterface {
  name = 'CreateSorobanTxIntents1782100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The escrow entity maps onChainId to escrows.on_chain_id; the column has to
    // exist before the unique index below can be built on it.
    await queryRunner.query(
      `ALTER TABLE "escrows" ADD COLUMN "on_chain_id" varchar(20) NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "soroban_tx_intents" (
        "id" varchar(36) NOT NULL,
        "escrowId" varchar(36) NOT NULL,
        "on_chain_escrow_id" varchar(20) NOT NULL,
        "userId" varchar(36) NOT NULL,
        "operation" varchar(32) NOT NULL,
        "source_account" varchar(56) NOT NULL,
        "network_passphrase" varchar(64) NOT NULL,
        "contract_id" varchar(56) NOT NULL,
        "intent_hash" varchar(64) NOT NULL,
        "unsigned_xdr" text NOT NULL,
        "expires_at" datetime NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT ('PENDING'),
        "fee_stroops" bigint NULL,
        "resource_fee_stroops" bigint NULL,
        "simulated_at_ledger" bigint NULL,
        "signed_xdr_hash" varchar(64) NULL,
        "txHash" varchar(64) NULL,
        "error_message" text NULL,
        "created_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        "updated_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP) ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY ("id"),
        CONSTRAINT "UQ_soroban_tx_intents_intent_hash" UNIQUE ("intent_hash")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_soroban_intents_escrow" ON "soroban_tx_intents" ("escrowId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_soroban_intents_user" ON "soroban_tx_intents" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_soroban_intents_status_expires" ON "soroban_tx_intents" ("status", "expires_at")`,
    );
    // The contract rejects a duplicate escrow id, so the mapping must be
    // unique once allocated.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "idx_escrows_on_chain_id" ON "escrows" ("on_chain_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_escrows_on_chain_id"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_soroban_intents_status_expires"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_soroban_intents_user"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_soroban_intents_escrow"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "soroban_tx_intents"`);
    await queryRunner.query(`ALTER TABLE "escrows" DROP COLUMN "on_chain_id"`);
  }
}
