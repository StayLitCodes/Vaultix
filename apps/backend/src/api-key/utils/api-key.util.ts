import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;
const KEY_PREFIX = 'vlt_';
const KEY_LENGTH = 32;

export function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(KEY_LENGTH).toString('hex');
  return `${KEY_PREFIX}${randomBytes}`;
}

export function getKeyPrefix(apiKey: string): string {
  return apiKey.substring(0, 8);
}

export async function hashKey(key: string): Promise<string> {
  return bcrypt.hash(key, SALT_ROUNDS);
}

export async function verifyKey(key: string, hash: string): Promise<boolean> {
  return bcrypt.compare(key, hash);
}
