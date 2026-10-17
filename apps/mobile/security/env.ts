import { Alert } from 'react-native';

export type Environment = 'dev' | 'testnet' | 'production';

export interface EnvConfig {
  environment: Environment;
  apiUrl: string;
  rpcUrl: string;
  /** Stellar network passphrase transactions are signed against (#709). */
  networkPassphrase: string;
}

const ENV: Environment = (process.env.EXPO_PUBLIC_APP_ENV as Environment) || 'dev';

const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
const PUBLIC_PASSPHRASE = 'Public Global Stellar Network ; September 2015';

const configs: Record<Environment, EnvConfig> = {
  dev: {
    environment: 'dev',
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
    rpcUrl: process.env.EXPO_PUBLIC_RPC_URL || 'http://localhost:8000/soroban/rpc',
    networkPassphrase: process.env.EXPO_PUBLIC_NETWORK_PASSPHRASE || TESTNET_PASSPHRASE,
  },
  testnet: {
    environment: 'testnet',
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://api-testnet.vaultix.com',
    rpcUrl: process.env.EXPO_PUBLIC_RPC_URL || 'https://soroban-testnet.stellar.org',
    networkPassphrase: process.env.EXPO_PUBLIC_NETWORK_PASSPHRASE || TESTNET_PASSPHRASE,
  },
  production: {
    environment: 'production',
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://api.vaultix.com',
    rpcUrl: process.env.EXPO_PUBLIC_RPC_URL || 'https://rpc.vaultix.com',
    networkPassphrase: process.env.EXPO_PUBLIC_NETWORK_PASSPHRASE || PUBLIC_PASSPHRASE,
  },
};

export const envConfig = configs[ENV];

const DEFAULTS: Record<Environment, EnvConfig> = {
  dev: {
    environment: 'dev',
    apiUrl: 'http://localhost:3000',
    rpcUrl: 'http://localhost:8000/soroban/rpc',
    networkPassphrase: TESTNET_PASSPHRASE,
  },
  testnet: {
    environment: 'testnet',
    apiUrl: 'https://api-testnet.vaultix.com',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    networkPassphrase: TESTNET_PASSPHRASE,
  },
  production: {
    environment: 'production',
    apiUrl: 'https://api.vaultix.com',
    rpcUrl: 'https://rpc.vaultix.com',
    networkPassphrase: PUBLIC_PASSPHRASE,
  },
};

const isEnvironment = (value: string | undefined): value is Environment =>
  value !== undefined && Object.prototype.hasOwnProperty.call(DEFAULTS, value);

export interface EnvVars {
  EXPO_PUBLIC_APP_ENV?: string;
  EXPO_PUBLIC_API_URL?: string;
}

// Expo only inlines EXPO_PUBLIC_* for static `process.env.X` reads, so collect them here once
const PROCESS_ENV_VARS: EnvVars = {
  EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
};

// An unknown EXPO_PUBLIC_APP_ENV falls back to dev instead of leaving the config undefined
export const resolveEnvConfig = (vars: EnvVars): EnvConfig => {
  const environment = isEnvironment(vars.EXPO_PUBLIC_APP_ENV) ? vars.EXPO_PUBLIC_APP_ENV : 'dev';
  return {
    ...DEFAULTS[environment],
    apiUrl: vars.EXPO_PUBLIC_API_URL || DEFAULTS[environment].apiUrl,
  };
};

/** Notices about unset or invalid variables, empty when fully configured. */
export const getEnvNotices = (vars: EnvVars): string[] => {
  const { environment } = resolveEnvConfig(vars);
  const notices: string[] = [];

  if (!vars.EXPO_PUBLIC_APP_ENV) {
    notices.push('EXPO_PUBLIC_APP_ENV is not set - defaulting to "dev"');
  } else if (!isEnvironment(vars.EXPO_PUBLIC_APP_ENV)) {
    notices.push(
      `EXPO_PUBLIC_APP_ENV="${vars.EXPO_PUBLIC_APP_ENV}" is not one of dev, testnet, production - defaulting to "dev"`,
    );
  }

  if (!vars.EXPO_PUBLIC_API_URL) {
    notices.push(
      `EXPO_PUBLIC_API_URL is not set - using ${environment} default ${DEFAULTS[environment].apiUrl}`,
    );
  }

  return notices;
};

export const envConfig: EnvConfig = resolveEnvConfig(PROCESS_ENV_VARS);

/** Called once from app/_layout.tsx on startup. Returns the notices it logged. */
export const validateEnv = (vars: EnvVars = PROCESS_ENV_VARS): string[] => {
  const notices = getEnvNotices(vars);

  if (notices.length > 0) {
    const message = [
      `[envConfig] Environment: ${resolveEnvConfig(vars).environment}`,
      ...notices.map((n) => `  ⚠️  ${n}`),
    ].join('\n');
    console.warn(message);
    if (__DEV__) {
      setTimeout(() => {
        // React Native has no global `alert` — it is a browser/DOM global, so
        // calling it threw `ReferenceError: alert is not defined` in any dev
        // build that actually had a notice to show (#783).
        Alert.alert('⚠️  Vaultix Configuration Notice', message);
      }, 500);
    }
  }

  return notices;
};
