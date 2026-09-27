import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKycAndAml1780700000000 implements MigrationInterface {
  name = 'AddKycAndAml1780700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add kyc_status column to users table
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD "kycStatus" varchar NOT NULL DEFAULT 'not_started'
    `);

    // Add kyc_rejection_reason column to users table
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD "kycRejectionReason" varchar
    `);

    // Add kyc_verified_at column to users table
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD "kycVerifiedAt" datetime
    `);

    // Create kyc_verifications table
    await queryRunner.query(`
      CREATE TABLE "kyc_verifications" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "provider" varchar NOT NULL DEFAULT 'mock',
        "providerVerificationId" varchar,
        "status" varchar NOT NULL DEFAULT 'pending',
        "rejectionReason" varchar,
        "providerMetadata" text,
        "initiatedAt" datetime,
        "completedAt" datetime,
        "expiresAt" datetime,
        "createdAt" datetime DEFAULT now(),
        "updatedAt" datetime DEFAULT now(),
        CONSTRAINT "FK_kyc_verifications_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for kyc_verifications
    await queryRunner.query(
      `CREATE INDEX "idx_kyc_user" ON "kyc_verifications" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_kyc_provider_status" ON "kyc_verifications" ("provider", "status")`,
    );

    // Create indexes on users for KYC queries
    await queryRunner.query(
      `CREATE INDEX "idx_users_kyc_status" ON "users" ("kycStatus")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_users_kyc_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_kyc_provider_status"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_kyc_user"`);

    // Drop kyc_verifications table
    await queryRunner.query(`DROP TABLE "kyc_verifications"`);

    // Remove KYC columns from users
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "kycVerifiedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "kycRejectionReason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "kycStatus"`,
    );
  }
}
