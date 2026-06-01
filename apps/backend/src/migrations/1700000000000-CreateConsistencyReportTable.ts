import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateConsistencyReportTable1700000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'consistency_reports',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'escrowId',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'severity',
            type: 'varchar',
            length: '20',
          },
          {
            name: 'discrepancies',
            type: 'text',
          },
          {
            name: 'metadata',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'resolved',
            type: 'boolean',
            default: false,
          },
          {
            name: 'resolvedByUserId',
            type: 'varchar',
            length: '36',
            isNullable: true,
          },
          {
            name: 'resolvedAt',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'consistency_reports',
      new TableIndex({
        name: 'idx_consistency_escrow_id',
        columnNames: ['escrowId'],
      }),
    );

    await queryRunner.createIndex(
      'consistency_reports',
      new TableIndex({
        name: 'idx_consistency_severity',
        columnNames: ['severity'],
      }),
    );

    await queryRunner.createIndex(
      'consistency_reports',
      new TableIndex({
        name: 'idx_consistency_created_at',
        columnNames: ['createdAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('consistency_reports');
  }
}
