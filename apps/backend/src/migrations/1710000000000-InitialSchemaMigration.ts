// backend/migrations/1710000000000-InitialSchemaMigration.ts
import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class InitialSchemaMigration1710000000000 implements MigrationInterface {
    name = 'InitialSchemaMigration1710000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create users table
        await queryRunner.createTable(
            new Table({
                name: 'users',
                columns: [
                    { name: 'id', type: 'varchar', isPrimary: true, generationStrategy: 'uuid' },
                    { name: 'email', type: 'varchar', isUnique: true },
                    { name: 'password', type: 'varchar' },
                    { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
                ],
            }),
            true
        );

        // Create email_verifications table ensuring complete parity across CLI and runtime
        await queryRunner.createTable(
            new Table({
                name: 'email_verifications',
                columns: [
                    { name: 'id', type: 'varchar', isPrimary: true, generationStrategy: 'uuid' },
                    { name: 'email', type: 'varchar', isUnique: true },
                    { name: 'token', type: 'varchar' },
                    { name: 'isVerified', type: 'boolean', default: 0 },
                    { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
                ],
            }),
            true
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('email_verifications');
        await queryRunner.dropTable('users');
    }
}