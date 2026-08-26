/**
 * #550 — the welcome screen's sign-in must be a real challenge/response
 * exchange: nonce from the backend, signed by the wallet, swapped for a JWT.
 */
jest.mock('../services/api', () => ({
  authApi: {
    requestChallenge: jest.fn(),
    verifySignature: jest.fn(),
  },
}));

jest.mock('../services/wallet', () => ({
  connectWithBuiltInWallet: jest.fn(),
  signMessage: jest.fn(),
}));

const mockStore = new Map<string, string>();
jest.mock('../utils/secureStore', () => ({
  saveSecureItem: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  getSecureItem: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  deleteSecureItem: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

import { authApi } from '../services/api';
import { connectWithBuiltInWallet, signMessage } from '../services/wallet';
import { signInWithBuiltInWallet } from '../services/walletAuth';
import { __resetSessionForTests, getAccessToken, getSession } from '../services/session';

const ADDRESS = 'GCEXAMPLEADDRESSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const CHALLENGE = 'Sign this message to authenticate with Vaultix: 9f2c';

const mockConnect = connectWithBuiltInWallet as jest.Mock;
const mockSign = signMessage as jest.Mock;
const mockChallenge = authApi.requestChallenge as jest.Mock;
const mockVerify = authApi.verifySignature as jest.Mock;

beforeEach(() => {
  mockStore.clear();
  __resetSessionForTests();
  jest.clearAllMocks();

  mockConnect.mockResolvedValue({ address: ADDRESS, method: 'secure-mobile' });
  mockChallenge.mockResolvedValue({ nonce: '9f2c', message: CHALLENGE });
  mockSign.mockResolvedValue('deadbeef');
  mockVerify.mockResolvedValue({ accessToken: 'access.jwt', refreshToken: 'refresh.jwt' });
});

describe('signInWithBuiltInWallet', () => {
  it('runs connect → challenge → sign → verify in order', async () => {
    await signInWithBuiltInWallet();

    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockChallenge).toHaveBeenCalledWith(ADDRESS);
    // The exact server-issued message is signed, not the bare nonce.
    expect(mockSign).toHaveBeenCalledWith(CHALLENGE);
    expect(mockVerify).toHaveBeenCalledWith(ADDRESS, 'deadbeef');
  });

  it('persists the returned JWT pair through the session layer', async () => {
    const session = await signInWithBuiltInWallet();

    expect(session.walletAddress).toBe(ADDRESS);
    expect(getAccessToken()).toBe('access.jwt');
    expect(mockStore.get('vaultix-access-token')).toBe('access.jwt');
    expect(mockStore.get('vaultix-refresh-token')).toBe('refresh.jwt');
  });

  it('never invents a token or address', async () => {
    const session = await signInWithBuiltInWallet();
    expect(session.accessToken).not.toBe('simulated-jwt-token');
    expect(session.walletAddress).not.toBe('GABCD...XYZ');
  });

  it('propagates a network failure and leaves no session behind', async () => {
    mockChallenge.mockRejectedValue({ code: 'ERR_NETWORK' });

    await expect(signInWithBuiltInWallet()).rejects.toMatchObject({ code: 'ERR_NETWORK' });
    expect(getSession()).toBeNull();
    expect(mockStore.size).toBe(0);
  });

  it('propagates a rejected signature without signing in', async () => {
    mockVerify.mockRejectedValue({ response: { status: 401 } });

    await expect(signInWithBuiltInWallet()).rejects.toBeDefined();
    expect(getSession()).toBeNull();
  });

  it('rejects a malformed challenge instead of signing garbage', async () => {
    mockChallenge.mockResolvedValue({ nonce: '9f2c' });

    await expect(signInWithBuiltInWallet()).rejects.toThrow(/invalid sign-in challenge/i);
    expect(mockSign).not.toHaveBeenCalled();
  });

  it('rejects a verify response with no access token', async () => {
    mockVerify.mockResolvedValue({ accessToken: '', refreshToken: 'refresh.jwt' });

    await expect(signInWithBuiltInWallet()).rejects.toThrow(/access token/i);
    expect(getSession()).toBeNull();
  });
});
