import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sqlite3 from 'sqlite3';
import { Pool } from 'pg';

interface TableDump {
  name: string;
  columns: string[];
  rows: Record<string, unknown>[];
}

const sqlitePath = resolve(process.env.DATABASE_PATH || './data/vaultix.db');
const postgresUrl = process.env.DATABASE_URL;
const dumpPath = process.argv[2];
const jsonColumns = new Set([
  'metadata',
  'payload',
  'eventTypes',
  'events',
  'extractedFields',
  'evidence',
  'evidenceFiles',
  'scopes',
]);

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function openSqlite(): Promise<sqlite3.Database> {
  return new Promise((resolveDatabase, reject) => {
    const database = new sqlite3.Database(sqlitePath, (error) =>
      error ? reject(error) : resolveDatabase(database),
    );
  });
}

function all(database: sqlite3.Database, sql: string): Promise<Record<string, unknown>[]> {
  return new Promise((resolveRows, reject) => {
    database.all(sql, (error, rows) => (error ? reject(error) : resolveRows(rows as Record<string, unknown>[])));
  });
}

async function exportSqlite(): Promise<TableDump[]> {
  if (!existsSync(sqlitePath)) {
    throw new Error(`SQLite database not found: ${sqlitePath}`);
  }
  const database = await openSqlite();
  try {
    const tables = await all(
      database,
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != 'migrations'",
    );
    const dumps: TableDump[] = [];
    for (const table of tables) {
      const name = String(table.name);
      const columns = (await all(database, `PRAGMA table_info(${quoteIdentifier(name)})`)).map((column) => String(column.name));
      const rows = await all(database, `SELECT * FROM ${quoteIdentifier(name)}`);
      dumps.push({ name, columns, rows });
    }
    return dumps;
  } finally {
    database.close();
  }
}

function parseValue(column: string, value: unknown): unknown {
  if (value === null || value === undefined || !jsonColumns.has(column) || typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function importPostgres(dumps: TableDump[]): Promise<void> {
  if (!postgresUrl) {
    throw new Error('DATABASE_URL is required for PostgreSQL import');
  }
  const pool = new Pool({ connectionString: postgresUrl, max: 20, idleTimeoutMillis: 30_000 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const table of dumps) {
      if (!table.rows.length) continue;
      const columns = table.columns.map(quoteIdentifier).join(', ');
      for (const row of table.rows) {
        const values = table.columns.map((column) => parseValue(column, row[column]));
        const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
        await client.query(
          `INSERT INTO ${quoteIdentifier(table.name)} (${columns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          values,
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main(): Promise<void> {
  const dumps = dumpPath && existsSync(dumpPath)
    ? JSON.parse(readFileSync(dumpPath, 'utf8')) as TableDump[]
    : await exportSqlite();
  if (dumpPath && !existsSync(dumpPath)) {
    writeFileSync(dumpPath, JSON.stringify(dumps, null, 2));
    console.log(`SQLite export written to ${dumpPath}`);
    return;
  }
  await importPostgres(dumps);
  console.log(`Imported ${dumps.length} tables into PostgreSQL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
