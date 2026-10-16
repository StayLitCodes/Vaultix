import { getDatabaseDriver } from './database.config';

export function databaseDateType(): 'datetime' | 'timestamp' {
  return getDatabaseDriver() === 'postgres' ? 'timestamp' : 'datetime';
}

export function databaseJsonType(): 'simple-json' | 'jsonb' {
  return getDatabaseDriver() === 'postgres' ? 'jsonb' : 'simple-json';
}