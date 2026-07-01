import { registerAs } from '@nestjs/config';

export default registerAs('stellar', () => ({
  network: process.env.STELLAR_NETWORK || 'testnet',
  horizonUrl:
    process.env.HORIZON_URL ||
    (process.env.STELLAR_NETWORK === 'mainnet'
      ? 'https://horizon.stellar.org'
      : 'https://horizon-testnet.stellar.org'),
  networkPassphrase:
    process.env.STELLAR_NETWORK_PASSPHRASE ||
    (process.env.STELLAR_NETWORK === 'mainnet'
      ? 'Public Global Stellar Network ; September 2015'
      : 'Test SDF Network ; September 2015'),
  walletSecret: process.env.WALLET_SECRET || '',
  timeout: parseInt(process.env.STELLAR_TIMEOUT || '60000', 10),
  maxRetries: parseInt(process.env.STELLAR_MAX_RETRIES || '3', 10),
  retryDelay: parseInt(process.env.STELLAR_RETRY_DELAY || '1000', 10),
  circuitBreakerMaxFailures: parseInt(process.env.STELLAR_CIRCUIT_BREAKER_MAX_FAILURES || '5', 10),
  circuitBreakerResetTimeout: parseInt(process.env.STELLAR_CIRCUIT_BREAKER_RESET_TIMEOUT || '60000', 10),
  retryJitter: parseFloat(process.env.STELLAR_RETRY_JITTER || '0.1'),
  retryFactor: parseFloat(process.env.STELLAR_RETRY_FACTOR || '2.0'),
}));