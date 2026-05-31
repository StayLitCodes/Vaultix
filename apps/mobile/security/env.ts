export type Environment = 'dev' | 'testnet' | 'production';

export interface EnvConfig {
  environment: Environment;
  apiUrl: string;
  rpcUrl: string;
}

const ENV: Environment = (process.env.EXPO_PUBLIC_APP_ENV as Environment) || 'dev';

const configs: Record<Environment, EnvConfig> = {
  dev: {
    environment: 'dev',
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
    rpcUrl: process.env.EXPO_PUBLIC_RPC_URL || 'http://127.0.0.1:8545',
  },
  testnet: {
    environment: 'testnet',
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://api-testnet.vaultix.com',
    rpcUrl: process.env.EXPO_PUBLIC_RPC_URL || 'https://rpc-testnet.vaultix.com',
  },
  production: {
    environment: 'production',
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://api.vaultix.com',
    rpcUrl: process.env.EXPO_PUBLIC_RPC_URL || 'https://rpc.vaultix.com',
  },
};

export const envConfig = configs[ENV];

export const validateEnv = () => {
  if (!envConfig.apiUrl || !envConfig.rpcUrl) {
    console.warn('Missing required environment variables for', ENV);
  }
};
