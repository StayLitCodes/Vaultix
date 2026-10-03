/**
 * Unit tests for security/env.ts
 */
import { envConfig, getEnvNotices, resolveEnvConfig, validateEnv } from '../security/env';

describe('resolveEnvConfig', () => {
  it('uses EXPO_PUBLIC_API_URL when set', () => {
    expect(
      resolveEnvConfig({ EXPO_PUBLIC_APP_ENV: 'testnet', EXPO_PUBLIC_API_URL: 'https://custom.example.com' }),
    ).toEqual({ environment: 'testnet', apiUrl: 'https://custom.example.com' });
  });

  it('falls back to the per-environment default API URL', () => {
    expect(resolveEnvConfig({ EXPO_PUBLIC_APP_ENV: 'production' }).apiUrl).toBe('https://api.vaultix.com');
    expect(resolveEnvConfig({ EXPO_PUBLIC_APP_ENV: 'testnet' }).apiUrl).toBe('https://api-testnet.vaultix.com');
  });

  it('falls back to dev for a missing or unknown EXPO_PUBLIC_APP_ENV', () => {
    expect(resolveEnvConfig({})).toEqual({ environment: 'dev', apiUrl: 'http://localhost:3000' });
    expect(resolveEnvConfig({ EXPO_PUBLIC_APP_ENV: 'staging' }).environment).toBe('dev');
    expect(resolveEnvConfig({ EXPO_PUBLIC_APP_ENV: 'toString' }).environment).toBe('dev');
  });

  it('does not expose an rpcUrl', () => {
    expect(envConfig).not.toHaveProperty('rpcUrl');
    expect(resolveEnvConfig({ EXPO_PUBLIC_APP_ENV: 'production' })).not.toHaveProperty('rpcUrl');
  });
});

describe('getEnvNotices', () => {
  it('is empty when fully configured', () => {
    expect(getEnvNotices({ EXPO_PUBLIC_APP_ENV: 'dev', EXPO_PUBLIC_API_URL: 'http://localhost:3000' })).toEqual([]);
  });

  it('reports an unknown environment and a missing API URL', () => {
    expect(getEnvNotices({ EXPO_PUBLIC_APP_ENV: 'staging' })).toEqual([
      'EXPO_PUBLIC_APP_ENV="staging" is not one of dev, testnet, production - defaulting to "dev"',
      'EXPO_PUBLIC_API_URL is not set - using dev default http://localhost:3000',
    ]);
  });
});

describe('validateEnv', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    jest.useRealTimers();
  });

  it('warns once with the notices when something is missing', () => {
    const notices = validateEnv({ EXPO_PUBLIC_APP_ENV: 'production' });
    expect(notices).toEqual(['EXPO_PUBLIC_API_URL is not set - using production default https://api.vaultix.com']);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('[envConfig] Environment: production');
  });

  it('stays silent when fully configured', () => {
    expect(validateEnv({ EXPO_PUBLIC_APP_ENV: 'testnet', EXPO_PUBLIC_API_URL: 'https://x.example.com' })).toEqual([]);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
