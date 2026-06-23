import { MigrationInterface, QueryRunner } from 'typeorm';

export class ImplementFourFeatures1780262000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new fields to User entity
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "displayName" varchar(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "email" varchar(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "emailVerified" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "avatarUrl" varchar(500)`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "bio" text`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "preferredAsset" varchar(20) NOT NULL DEFAULT 'XLM'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_email" ON "users" ("email") WHERE "email" IS NOT NULL`,
    );

    // Create EmailVerification table
    await queryRunner.query(`
            CREATE TABLE "email_verifications" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NOT NULL,
                "token" character varying NOT NULL,
                "expiresAt" TIMESTAMP NOT NULL,
                "isUsed" boolean NOT NULL DEFAULT false,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_email_verifications_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_email_verifications_token" UNIQUE ("token")
            )
        `);
    await queryRunner.query(
      `ALTER TABLE "email_verifications" ADD CONSTRAINT "FK_email_verifications_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE`,
    );

    // Add new fields to Escrow entity
    await queryRunner.query(
      `ALTER TABLE "escrows" ADD COLUMN "releasedAmount" numeric(18,7) NOT NULL DEFAULT 0`,
    );

    // Add new fields to Condition entity
    await queryRunner.query(
      `ALTER TABLE "escrow_conditions" ADD COLUMN "isReleased" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrow_conditions" ADD COLUMN "releasedAt" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop new columns from Condition entity
    await queryRunner.query(
      `ALTER TABLE "escrow_conditions" DROP COLUMN "releasedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "escrow_conditions" DROP COLUMN "isReleased"`,
    );

    // Drop new columns from Escrow entity
    await queryRunner.query(
      `ALTER TABLE "escrows" DROP COLUMN "releasedAmount"`,
    );

    // Drop EmailVerification table
    await queryRunner.query(`DROP TABLE "email_verifications"`);

    // Drop new columns from User entity
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_email"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "preferredAsset"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "bio"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatarUrl"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "emailVerified"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "displayName"`);
  }
}
