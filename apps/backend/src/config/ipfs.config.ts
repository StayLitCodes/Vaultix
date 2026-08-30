import { registerAs } from '@nestjs/config';

export default registerAs('ipfs', () => ({
  provider: process.env.IPFS_PROVIDER || 'pinata',
  pinataApiKey: process.env.PINATA_API_KEY,
  pinataSecretApiKey: process.env.PINATA_SECRET_API_KEY,
  pinataJwt: process.env.PINATA_JWT,
  gatewayUrl:
    process.env.IPFS_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs/',
  localNodeUrl: process.env.IPFS_LOCAL_NODE_URL || 'http://localhost:5001',
  maxRetries: parseInt(process.env.IPFS_MAX_RETRIES || '1', 10),
}));
