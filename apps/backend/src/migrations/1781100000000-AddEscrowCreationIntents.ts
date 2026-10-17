import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEscrowCreationIntents1781100000000 implements MigrationInterface {
  name = 'AddEscrowCreationIntents1781100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "escrows" ADD "chainEscrowId" varchar`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_escrows_chainEscrowId" ON "escrows" ("chainEscrowId")`,
    );
    await queryRunner.query(`
      CREATE TABLE "escrow_creation_intents" (
        "id" varchar(80) PRIMARY KEY NOT NULL,
        "creatorId" varchar NOT NULL,
        "sourceAddress" varchar NOT NULL,
        "chainEscrowId" varchar NOT NULL,
        "payload" text NOT NULL,
        "unsignedXdr" text NOT NULL,
        "transactionHash" varchar,
        "escrowId" varchar,
        "status" varchar NOT NULL DEFAULT 'prepared',
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_creation_intents_creator" ON "escrow_creation_intents" ("creatorId")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_creation_intents_creator"`);
    await queryRunner.query(`DROP TABLE "escrow_creation_intents"`);
    await queryRunner.query(`DROP INDEX "IDX_escrows_chainEscrowId"`);
    await queryRunner.query(
      `ALTER TABLE "escrows" DROP COLUMN "chainEscrowId"`,
    );
  }
}
