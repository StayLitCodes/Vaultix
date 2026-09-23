import { registerAs } from '@nestjs/config';

export type DatabaseDriver = 'sqlite' | 'postgres';

export function getDatabaseDriver(value = process.env.DATABASE_DRIVER): DatabaseDriver {
  const driver = (value || 'sqlite').toLowerCase();
  if (driver !== 'sqlite' && driver !== 'postgres') {
    throw new Error(`Unsupported DATABASE_DRIVER: ${driver}`);
  }
  return driver;
}

export default registerAs('database', () => ({
  driver: getDatabaseDriver(),
  path: process.env.DATABASE_PATH || './data/vaultix.db',
  url: process.env.DATABASE_URL,
}));