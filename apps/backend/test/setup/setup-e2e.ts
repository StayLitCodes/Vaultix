import crypto from 'node:crypto';

process.env.DATABASE_PATH = ':memory:';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.STELLAR_CONTRACT_ID = 'CACVKL567TEST';

// Polyfill for crypto in test environment
if (typeof global.crypto === 'undefined') {
  global.crypto = crypto as typeof global.crypto;
}
