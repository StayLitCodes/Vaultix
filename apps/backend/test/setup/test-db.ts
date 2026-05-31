import { DataSource } from 'typeorm';

export async function resetDatabase(dataSource: DataSource) {
  const entities = dataSource.entityMetadatas;

  for (const entity of entities) {
    const repo = dataSource.getRepository(entity.name);
    await repo.query(`DELETE FROM ${entity.tableName}`);
  }
}
