import * as crypto from 'crypto';

export function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}
