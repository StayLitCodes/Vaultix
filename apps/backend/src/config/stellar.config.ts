import { registerAs } from '@nestjs/config';

export default registerAs('stellar', () => ({
  network: process.env.STELLAR_NETWORK || 'testnet', // 'testnet' or 'mainnet'
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
  timeout: parseInt(process.env.STELLAR_TIMEOUT || '60000', 10), // 60 seconds
  maxRetries: parseInt(process.env.STELLAR_MAX_RETRIES || '3', 10),
  retryDelay: parseInt(process.env.STELLAR_RETRY_DELAY || '1000', 10), // 1 second base delay
}));
