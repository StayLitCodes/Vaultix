import { registerAs } from '@nestjs/config';

export default registerAs('ipfs', () => ({
  pinataApiKey: process.env.PINATA_API_KEY,
  pinataSecretApiKey: process.env.PINATA_SECRET_API_KEY,
  pinataJwt: process.env.PINATA_JWT,
  gatewayUrl:
    process.env.IPFS_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs/',
}));
