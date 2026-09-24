import { MigrationInterface, QueryRunner } from 'typeorm';

export class UseExactEscrowAmounts1790000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type === 'sqlite') {
      for (const [table, column] of [
        ['escrows', 'amount'],
        ['escrows', 'releasedAmount'],
        ['escrow_conditions', 'amount'],
        ['escrow_conditions', 'proposedAmount'],
      ]) {
        const legacy = `${column}_legacy_exact`;
        await queryRunner.query(
          `ALTER TABLE "${table}" RENAME COLUMN "${column}" TO "${legacy}"`,
        );
        await queryRunner.query(
          `ALTER TABLE "${table}" ADD COLUMN "${column}" varchar(64)`,
        );
        await queryRunner.query(
          `UPDATE "${table}" SET "${column}" = CAST("${legacy}" AS TEXT)`,
        );
      }
      await queryRunner.query(
        `UPDATE "escrows" SET "amount" = '0' WHERE "amount" IS NULL`,
      );
      await queryRunner.query(
        `UPDATE "escrows" SET "releasedAmount" = '0' WHERE "releasedAmount" IS NULL`,
      );
      return;
    }

    await queryRunner.query(
      `ALTER TABLE "escrows" ALTER COLUMN "amount" TYPE numeric(38,18) USING "amount"::numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrows" ALTER COLUMN "releasedAmount" TYPE numeric(38,18) USING "releasedAmount"::numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrow_conditions" ALTER COLUMN "amount" TYPE numeric(38,18) USING "amount"::numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrow_conditions" ALTER COLUMN "proposedAmount" TYPE numeric(38,18) USING "proposedAmount"::numeric`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type === 'sqlite') {
      for (const [table, column] of [
        ['escrows', 'amount'],
        ['escrows', 'releasedAmount'],
        ['escrow_conditions', 'amount'],
        ['escrow_conditions', 'proposedAmount'],
      ]) {
        const legacy = `${column}_legacy_exact`;
        await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "${column}"`);
        await queryRunner.query(
          `ALTER TABLE "${table}" RENAME COLUMN "${legacy}" TO "${column}"`,
        );
      }
      return;
    }

    await queryRunner.query(
      `ALTER TABLE "escrows" ALTER COLUMN "amount" TYPE numeric(18,7) USING "amount"::numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrows" ALTER COLUMN "releasedAmount" TYPE numeric(18,7) USING "releasedAmount"::numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrow_conditions" ALTER COLUMN "amount" TYPE numeric(18,7) USING "amount"::numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrow_conditions" ALTER COLUMN "proposedAmount" TYPE numeric(18,7) USING "proposedAmount"::numeric`,
    );
  }
}
