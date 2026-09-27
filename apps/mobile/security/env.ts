export type Environment = 'dev' | 'testnet' | 'production';

export interface EnvConfig {
  environment: Environment;
  apiUrl: string;
}

/*
 * No rpcUrl here on purpose: the mobile client only builds keypairs and signs
 * XDR locally (services/wallet.ts). The backend talks to Soroban RPC and
 * submits transactions, so the app never needs an RPC endpoint of its own.
 */
const DEFAULTS: Record<Environment, EnvConfig> = {
  dev: {
    environment: 'dev',
    apiUrl: 'http://localhost:3000',
  },
  testnet: {
    environment: 'testnet',
    apiUrl: 'https://api-testnet.vaultix.com',
  },
  production: {
    environment: 'production',
    apiUrl: 'https://api.vaultix.com',
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
        alert(`⚠️  Vaultix Configuration Notice\n\n${message}`);
      }, 500);
    }
  }

  return notices;
};
