/**
 * #709 — "Connect Wallet" must produce the device keypair's real public key
 * (a valid G… Stellar address), and that same keypair must be able to sign the
 * server-prepared envelopes used by escrow creation.
 */
import * as StellarSdk from '@stellar/stellar-sdk';

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

import {
  connectWithBuiltInWallet,
  getLocalWalletAddress,
  isValidStellarPublicKey,
  signTransactionXDR,
} from '../services/wallet';

beforeEach(() => {
  mockStore.clear();
});

describe('isValidStellarPublicKey', () => {
  it('rejects the old simulated placeholder', () => {
    expect(isValidStellarPublicKey('GABCD...XYZ')).toBe(false);
  });

  it('rejects non-strings and checksum-invalid keys', () => {
    expect(isValidStellarPublicKey(undefined)).toBe(false);
    expect(isValidStellarPublicKey('G' + 'A'.repeat(55))).toBe(false);
  });

  it('accepts a real public key', () => {
    expect(isValidStellarPublicKey(StellarSdk.Keypair.random().publicKey())).toBe(true);
  });
});

describe('connectWithBuiltInWallet', () => {
  it('returns the persisted keypair public key as a valid Stellar address', async () => {
    const { address, method } = await connectWithBuiltInWallet();

    expect(method).toBe('secure-mobile');
    expect(address).toMatch(/^G[A-Z2-7]{55}$/);
    expect(StellarSdk.StrKey.isValidEd25519PublicKey(address)).toBe(true);
    expect(await getLocalWalletAddress()).toBe(address);
  });

  it('returns the same address on reconnect', async () => {
    const first = await connectWithBuiltInWallet();
    const second = await connectWithBuiltInWallet();
    expect(second.address).toBe(first.address);
  });
});

describe('signTransactionXDR', () => {
  it('signs a prepared envelope with the connected wallet key', async () => {
    const { address } = await connectWithBuiltInWallet();
    const passphrase = StellarSdk.Networks.TESTNET;
    const unsigned = new StellarSdk.TransactionBuilder(new StellarSdk.Account(address, '1'), {
      fee: '100',
      networkPassphrase: passphrase,
    })
      .addOperation(StellarSdk.Operation.bumpSequence({ bumpTo: '2' }))
      .setTimeout(30)
      .build()
      .toXDR();

    const signedXdr = await signTransactionXDR(unsigned, passphrase);
    const signed = new StellarSdk.Transaction(signedXdr, passphrase);

    expect(signed.signatures).toHaveLength(1);
    expect(StellarSdk.Keypair.fromPublicKey(address).verify(signed.hash(), signed.signatures[0].signature())).toBe(true);
  });

  it('refuses to sign an empty envelope', async () => {
    await expect(signTransactionXDR('')).rejects.toThrow(/empty transaction/i);
  });
});
