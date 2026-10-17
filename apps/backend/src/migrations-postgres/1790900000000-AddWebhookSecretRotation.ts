import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWebhookSecretRotation1790900000000
  implements MigrationInterface
{
  name = 'AddWebhookSecretRotation1790900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "webhooks" ADD COLUMN "previousSecret" character varying',
    );
    await queryRunner.query(
      'ALTER TABLE "webhooks" ADD COLUMN "previousSecretExpiresAt" TIMESTAMP WITH TIME ZONE',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "webhooks" DROP COLUMN "previousSecretExpiresAt"',
    );
    await queryRunner.query(
      'ALTER TABLE "webhooks" DROP COLUMN "previousSecret"',
    );
  }
}