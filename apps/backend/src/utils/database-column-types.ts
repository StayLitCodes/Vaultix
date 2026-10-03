import { config } from 'dotenv';

// Entity files (which read DATETIME_COLUMN_TYPE below) are imported at the
// top of app.module.ts/data-source.ts, before Nest's ConfigModule has had a
// chance to load .env at runtime. Load it here too so DATABASE_URL is
// already in process.env by the time this module is evaluated, however it
// was reached.
config();

/**
 * TypeORM validates explicit column `type` values per-driver, and 'datetime'
 * is only a valid type for the sqlite driver family (postgres uses
 * 'timestamptz'/'timestamp' instead). Entities are shared between both
 * drivers, so pick the right type once here based on which driver
 * `getDatabaseConfig` will select, and reuse it across entities.
 */
export const isPostgresDatabase = !!process.env.DATABASE_URL;

export const DATETIME_COLUMN_TYPE = isPostgresDatabase
  ? 'timestamptz'
  : 'datetime';
