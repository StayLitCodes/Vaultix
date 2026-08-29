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
    // Soroban RPC runs on port 8000 (soroban-rpc standalone) — not 8545 (EVM).
    rpcUrl: process.env.EXPO_PUBLIC_RPC_URL || 'http://127.0.0.1:8000',
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

/**
 * Validates that required environment variables are set.
 * In development, surfaces a visible console warning when config is missing
 * or still pointing at a localhost default (which may indicate the developer
 * hasn't configured their local backend/rpc yet).
 *
 * Issue #557: Called at app start from app/_layout.tsx.
 */
export const validateEnv = () => {
  const warnings: string[] = [];

  if (!envConfig.apiUrl) {
    warnings.push('EXPO_PUBLIC_API_URL is not set');
  }

  if (!envConfig.rpcUrl) {
    warnings.push('EXPO_PUBLIC_RPC_URL is not set');
  }

  if (ENV === 'dev') {
    if (envConfig.apiUrl === 'http://localhost:3000') {
      warnings.push(
        'EXPO_PUBLIC_API_URL is using the default localhost URL — set it explicitly in .env if your backend runs elsewhere',
      );
    }
    if (envConfig.rpcUrl === 'http://127.0.0.1:8000') {
      warnings.push(
        'EXPO_PUBLIC_RPC_URL is using the default local Soroban RPC URL — set it explicitly in .env if your RPC runs elsewhere',
      );
    }
  }

  if (warnings.length > 0) {
    console.warn(
      `[env] Environment configuration warnings for "${ENV}":\n` +
        warnings.map((w) => `  • ${w}`).join('\n'),
    );
  }
};
