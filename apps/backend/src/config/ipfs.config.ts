import { registerAs } from '@nestjs/config';

// Registers an "ipfs" namespace in NestJS config; injectable elsewhere via
// ConfigService.get('ipfs.xxx') or @Inject the 'ipfs' token.
export default registerAs('ipfs', () => ({
  // Which IPFS pinning/storage provider to use (e.g. "pinata" vs a
  // self-hosted/local node); determines which of the settings below apply.
  provider: process.env.IPFS_PROVIDER || 'pinata',
  // Pinata API key/secret pair (legacy auth method).
  pinataApiKey: process.env.PINATA_API_KEY,
  pinataSecretApiKey: process.env.PINATA_SECRET_API_KEY,
  // Pinata JWT (newer auth method); may be used instead of the key/secret
  // pair above depending on how the client authenticates.
  pinataJwt: process.env.PINATA_JWT,
  // Public gateway URL used to build shareable/fetchable links to pinned
  // content (content hash gets appended to this base).
  gatewayUrl:
    process.env.IPFS_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs/',
  // Endpoint for a locally-run IPFS node, used when provider is set to
  // something other than a hosted pinning service.
  localNodeUrl: process.env.IPFS_LOCAL_NODE_URL || 'http://localhost:5001',
  // How many times to retry a failed IPFS upload/pin operation.
  maxRetries: parseInt(process.env.IPFS_MAX_RETRIES || '1', 10),
}));