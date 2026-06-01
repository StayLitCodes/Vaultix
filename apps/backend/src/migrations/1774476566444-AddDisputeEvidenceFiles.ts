import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddDisputeEvidenceFiles1774476566444
  implements MigrationInterface
{
  name = 'AddDisputeEvidenceFiles1774476566444';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'disputes',
      new TableColumn({
        name: 'evidenceFiles',
        type: 'text',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('disputes', 'evidenceFiles');
  }
}
