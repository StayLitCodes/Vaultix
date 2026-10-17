import { registerAs } from '@nestjs/config';

// Registers a "stellar" namespace in NestJS config; injectable elsewhere via
// ConfigService.get('stellar.xxx') or @Inject the 'stellar' token.
export default registerAs('stellar', () => ({
  // Which Stellar network to target; drives the horizonUrl/passphrase
  // defaults below when those aren't explicitly overridden.
  network: process.env.STELLAR_NETWORK || 'testnet', // 'testnet' or 'mainnet'
  // Horizon API endpoint for submitting transactions and querying ledger
  // state. Defaults based on `network`, but can be overridden directly
  // (e.g. to point at a custom/private Horizon instance).
  horizonUrl:
    process.env.HORIZON_URL ||
    (process.env.STELLAR_NETWORK === 'mainnet'
      ? 'https://horizon.stellar.org'
      : 'https://horizon-testnet.stellar.org'),
  // Network passphrase included when signing transactions; must match the
  // target network exactly or signed transactions will be rejected.
  networkPassphrase:
    process.env.STELLAR_NETWORK_PASSPHRASE ||
    (process.env.STELLAR_NETWORK === 'mainnet'
      ? 'Public Global Stellar Network ; September 2015'
      : 'Test SDF Network ; September 2015'),
  // Secret key for the wallet used to sign outgoing transactions.
  // Sensitive: should come from a secrets manager/secure env store in
  // production, never committed or logged.
  walletSecret: process.env.WALLET_SECRET || '',
  // Request timeout (ms) for calls to Horizon.
  timeout: parseInt(process.env.STELLAR_TIMEOUT || '60000', 10), // 60 seconds
  // How many times to retry a failed Horizon request/transaction submission.
  maxRetries: parseInt(process.env.STELLAR_MAX_RETRIES || '3', 10),
  // Base delay (ms) between retries; presumably scaled up per attempt
  // (e.g. exponential backoff) wherever maxRetries is consumed.
  retryDelay: parseInt(process.env.STELLAR_RETRY_DELAY || '1000', 10), // 1 second base delay
}));