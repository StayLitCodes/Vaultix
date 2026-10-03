import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEscrowChainIdMapping1781200000000 implements MigrationInterface {
  name = 'AddEscrowChainIdMapping1781200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "escrow_chain_ids" (
      "id" varchar PRIMARY KEY NOT NULL,
      "network" varchar(32) NOT NULL,
      "contract_id" varchar(56) NOT NULL,
      "escrow_id" varchar(36) NOT NULL,
      "on_chain_id" varchar(20),
      "status" varchar(16) NOT NULL DEFAULT 'unmapped',
      "created_at" datetime NOT NULL DEFAULT (datetime('now')),
      CONSTRAINT "uq_escrow_chain_scope_escrow" UNIQUE ("network", "contract_id", "escrow_id"),
      CONSTRAINT "uq_escrow_chain_scope_chain_id" UNIQUE ("network", "contract_id", "on_chain_id")
    )`);
    await queryRunner.query(
      `CREATE INDEX "idx_escrow_chain_lookup" ON "escrow_chain_ids" ("network", "contract_id", "on_chain_id")`,
    );

    // Backfill only when the escrow's stored creation transaction hash matches a persisted
    // ESCROW_CREATED event. Every other historical row is explicitly marked unmapped.
    const network = process.env.STELLAR_NETWORK || 'testnet';
    const contractId = process.env.STELLAR_CONTRACT_ID || '';
    if (!contractId) {
      throw new Error(
        'STELLAR_CONTRACT_ID is required to scope historical escrow ID mappings',
      );
    }
    await queryRunner.query(
      `INSERT INTO "escrow_chain_ids" ("id", "network", "contract_id", "escrow_id", "on_chain_id", "status")
         SELECT lower(hex(randomblob(16))), ?, ?, e."id",
           (SELECT se."escrowId" FROM "stellar_events" se
             WHERE se."txHash" = e."stellarTxHash" AND se."eventType" = 'ESCROW_CREATED'
               AND se."escrowId" <> '' AND se."escrowId" NOT GLOB '*[^0-9]*'
               AND (length(se."escrowId") < 20 OR (length(se."escrowId") = 20 AND se."escrowId" <= '18446744073709551615'))
               AND (SELECT COUNT(*) FROM "stellar_events" same_tx
                 WHERE same_tx."txHash" = e."stellarTxHash" AND same_tx."eventType" = 'ESCROW_CREATED'
                   AND same_tx."escrowId" <> '' AND same_tx."escrowId" NOT GLOB '*[^0-9]*'
                   AND (length(same_tx."escrowId") < 20 OR (length(same_tx."escrowId") = 20 AND same_tx."escrowId" <= '18446744073709551615'))) = 1),
           CASE WHEN (SELECT COUNT(*) FROM "stellar_events" se
             WHERE se."txHash" = e."stellarTxHash" AND se."eventType" = 'ESCROW_CREATED'
               AND se."escrowId" <> '' AND se."escrowId" NOT GLOB '*[^0-9]*'
               AND (length(se."escrowId") < 20 OR (length(se."escrowId") = 20 AND se."escrowId" <= '18446744073709551615'))) = 1
             THEN 'mapped' ELSE 'unmapped' END
         FROM "escrows" e`,
      [network, contractId],
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_escrow_chain_lookup"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "escrow_chain_ids"`);
  }
}
