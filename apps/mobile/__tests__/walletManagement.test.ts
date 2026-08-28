/**
 * Tests for wallet management functions: reveal, import, remove.
 */
jest.mock('@stellar/stellar-sdk', () => ({
  Keypair: {
    fromSecret: jest.fn((seed: string) => ({
      secret: () => seed,
      publicKey: () => 'G' + 'A'.repeat(55),
    })),
    random: jest.fn(() => ({
      secret: () => 'S' + 'A'.repeat(55),
      publicKey: () => 'G' + 'B'.repeat(55),
    })),
  },
  Networks: { TESTNET: 'Test SDF Network ; September 2015' },
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

jest.mock('../services/session', () => ({
  clearSession: jest.fn(async () => {}),
}));

import { Keypair } from '@stellar/stellar-sdk';
import {
  revealWalletSeed,
  importWalletFromSeed,
  removeWallet,
  loadLocalWalletKeypair,
} from '../services/wallet';
import { clearSession } from '../services/session';

const MOCK_SEED = 'S' + 'A'.repeat(55);
const MOCK_ADDRESS = 'G' + 'A'.repeat(55);

beforeEach(() => {
  mockStore.clear();
  jest.clearAllMocks();
});

describe('revealWalletSeed', () => {
  it('returns the stored seed', async () => {
    mockStore.set('vaultix-wallet-seed', MOCK_SEED);
    const seed = await revealWalletSeed();
    expect(seed).toBe(MOCK_SEED);
  });

  it('throws when no wallet exists', async () => {
    await expect(revealWalletSeed()).rejects.toThrow('No wallet found');
  });
});

describe('importWalletFromSeed', () => {
  it('validates and stores the new keypair', async () => {
    const keypair = await importWalletFromSeed(MOCK_SEED);

    expect(Keypair.fromSecret).toHaveBeenCalledWith(MOCK_SEED);
    expect(mockStore.get('vaultix-wallet-seed')).toBe(MOCK_SEED);
    expect(mockStore.get('vaultix-wallet-address')).toBe(MOCK_ADDRESS);
    expect(keypair).toBeDefined();
  });

  it('clears the session after import', async () => {
    await importWalletFromSeed(MOCK_SEED);
    expect(clearSession).toHaveBeenCalledTimes(1);
  });

  it('throws on invalid seed format', async () => {
    (Keypair.fromSecret as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Invalid secret key');
    });

    await expect(importWalletFromSeed('not-a-real-seed')).rejects.toThrow('Invalid secret key');
  });
});

describe('removeWallet', () => {
  it('deletes seed and address from secure store', async () => {
    mockStore.set('vaultix-wallet-seed', MOCK_SEED);
    mockStore.set('vaultix-wallet-address', MOCK_ADDRESS);

    await removeWallet();

    expect(mockStore.has('vaultix-wallet-seed')).toBe(false);
    expect(mockStore.has('vaultix-wallet-address')).toBe(false);
  });

  it('clears the session', async () => {
    await removeWallet();
    expect(clearSession).toHaveBeenCalledTimes(1);
  });

  it('is safe to call when no wallet exists', async () => {
    await removeWallet();
    expect(clearSession).toHaveBeenCalledTimes(1);
  });
});

describe('loadLocalWalletKeypair', () => {
  it('returns null when no seed exists', async () => {
    const result = await loadLocalWalletKeypair();
    expect(result).toBeNull();
  });

  it('loads keypair from stored seed', async () => {
    mockStore.set('vaultix-wallet-seed', MOCK_SEED);
    const keypair = await loadLocalWalletKeypair();
    expect(keypair).toBeDefined();
    expect(keypair!.publicKey()).toBe(MOCK_ADDRESS);
  });
});
