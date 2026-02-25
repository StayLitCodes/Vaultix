import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWebhookTable1670000000000 implements MigrationInterface {
  name = 'CreateWebhookTable1670000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "webhooks" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "url" varchar NOT NULL,
        "secret" varchar NOT NULL,
        "events" text NOT NULL,
        "isActive" boolean DEFAULT true,
        "userId" uuid NOT NULL,
        "createdAt" TIMESTAMP DEFAULT now(),
        "updatedAt" TIMESTAMP DEFAULT now(),
        CONSTRAINT "FK_webhook_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "webhooks"');
  }
}
