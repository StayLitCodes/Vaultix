import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: AddRefundedStatusAndEvents
 *
 * Documents the addition of:
 * - EscrowStatus.REFUNDED ('refunded') — stored as varchar, no schema change needed
 * - EscrowEventType.REFUNDED / REFUND_FAILED / QUEUED_MANUAL_REFUND — stored as varchar
 * - NotificationEventType.ESCROW_REFUNDED / ESCROW_REFUND_FAILED — stored as varchar
 *
 * SQLite varchar columns accept any string so no ALTER TABLE is required.
 * This migration adds an index on (status, expiresAt) to speed up the
 * EscrowExpirationService cron query.
 */
export class AddRefundedStatusAndEvents1780400000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Index to accelerate the every-5-minute cron query:
    // WHERE status = 'active' AND expiresAt < NOW() AND isActive = 1
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_escrows_status_expires_active"
      ON "escrows" ("status", "expiresAt", "isActive")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_escrows_status_expires_active"
    `);
  }
}
