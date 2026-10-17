import { registerAs } from '@nestjs/config';

export type SupportedDatabaseType = 'postgres' | 'better-sqlite3';

export interface DatabaseConnectionOptions {
  type: SupportedDatabaseType;
  url?: string;
  database?: string;
  ssl?: false | { rejectUnauthorized: boolean };
  extra?: { min: number; max: number };
}

/**
 * Picks postgres when DATABASE_URL is set, otherwise falls back to sqlite
 * (via DATABASE_PATH) for local development. Shared by both the Nest
 * TypeOrmModule bootstrap (app.module.ts) and the TypeORM CLI data source
 * (data-source.ts) so the two never drift apart.
 */
export function getDatabaseType(): SupportedDatabaseType {
  return process.env.DATABASE_URL ? 'postgres' : 'better-sqlite3';
}

export function buildDatabaseConnectionOptions(): DatabaseConnectionOptions {
  if (getDatabaseType() === 'postgres') {
    const sslEnabled =
      process.env.DATABASE_SSL === 'true' ||
      process.env.NODE_ENV === 'production';

    return {
      type: 'postgres',
      url: process.env.DATABASE_URL,
      ssl: sslEnabled ? { rejectUnauthorized: false } : false,
      extra: {
        // Connection pool bounds for the underlying `pg` driver.
        min: parseInt(process.env.DATABASE_POOL_MIN || '2', 10),
        max: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
      },
    };
  }

  return {
    type: 'better-sqlite3',
    database: process.env.DATABASE_PATH || './data/vaultix.db',
  };
}

export default registerAs('database', () => ({
  type: getDatabaseType(),
  url: process.env.DATABASE_URL,
  path: process.env.DATABASE_PATH || './data/vaultix.db',
}));
