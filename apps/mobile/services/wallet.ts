// Polyfills the Stellar SDK needs on Hermes: `crypto.getRandomValues` for
// Keypair.random() and a global Buffer for its binary helpers. Must be imported
// before @stellar/stellar-sdk.
import 'react-native-get-random-values';
import { Buffer } from 'buffer';

import { Linking } from 'react-native';
import * as StellarSdk from '@stellar/stellar-sdk';
import { deleteSecureItem, getSecureItem, saveSecureItem } from '../utils/secureStore';
import { clearSession } from './session';

if (typeof (global as { Buffer?: unknown }).Buffer === 'undefined') {
  (global as { Buffer?: unknown }).Buffer = Buffer;
}

/**
 * Raised when the user backs out of a wallet prompt. Callers should return the
 * user to where they were without an error dialog (#550).
 */
export class WalletCancelledError extends Error {
  readonly code = 'WALLET_CANCELLED';

  constructor(message = 'Wallet request was cancelled.') {
    super(message);
    this.name = 'WalletCancelledError';
  }
}

/** True for both our own cancellation error and wallet-SDK cancel codes. */
export function isWalletCancelled(error: unknown): boolean {
  if (error instanceof WalletCancelledError) return true;
  if (!error || typeof error !== 'object') return false;
  const err = error as Record<string, unknown>;
  return (
    err.code === 'WALLET_CANCELLED' ||
    err.code === 'ERR_USER_CANCELLED' ||
    (typeof err.message === 'string' && /cancell?ed|rejected|denied/i.test(err.message))
  );
}

const WALLET_SEED_KEY = 'vaultix-wallet-seed';
const WALLET_ADDRESS_KEY = 'vaultix-wallet-address';

export type WalletConnectionMethod = 'secure-mobile';
export type ExternalWalletName = 'lobstr' | 'solar';

const EXTERNAL_WALLET_SCHEMES: Record<ExternalWalletName, string> = {
  lobstr: 'lobstr://',
  solar: 'solar://',
};

const EXTERNAL_WALLET_FALLBACK_URLS: Record<ExternalWalletName, string> = {
  lobstr: 'https://lobstr.co',
  solar: 'https://solarwallet.io',
};

const EXTERNAL_WALLET_LABELS: Record<ExternalWalletName, string> = {
  lobstr: 'Lobstr',
  solar: 'Solar',
};

export async function loadLocalWalletKeypair(): Promise<StellarSdk.Keypair | null> {
  const seed = await getSecureItem(WALLET_SEED_KEY);
  if (!seed) return null;
  try {
    return StellarSdk.Keypair.fromSecret(seed);
  } catch (error) {
    console.warn('Unable to load local Stellar wallet keypair:', error);
    await deleteSecureItem(WALLET_SEED_KEY);
    await deleteSecureItem(WALLET_ADDRESS_KEY);
    return null;
  }
}

export async function ensureLocalWalletKeypair(): Promise<StellarSdk.Keypair> {
  const existing = await loadLocalWalletKeypair();
  if (existing) return existing;

  const newKeypair = StellarSdk.Keypair.random();
  await saveSecureItem(WALLET_SEED_KEY, newKeypair.secret());
  await saveSecureItem(WALLET_ADDRESS_KEY, newKeypair.publicKey());
  return newKeypair;
}

export async function getLocalWalletAddress(): Promise<string | null> {
  const address = await getSecureItem(WALLET_ADDRESS_KEY);
  return address ?? null;
}

export async function connectWithBuiltInWallet(): Promise<{ address: string; method: WalletConnectionMethod }> {
  const keypair = await ensureLocalWalletKeypair();
  return { address: keypair.publicKey(), method: 'secure-mobile' };
}

/**
 * Signs an arbitrary UTF-8 message with the built-in wallet keypair and returns
 * a hex-encoded ed25519 signature — the encoding `POST /auth/verify` expects.
 */
export async function signMessage(message: string): Promise<string> {
  if (!message) {
    throw new Error('Cannot sign an empty message.');
  }
  const keypair = await ensureLocalWalletKeypair();
  const encoded = Buffer.from(message, 'utf8');
  const signature = keypair.sign(encoded);
  return Buffer.from(signature).toString('hex');
}

export async function signTransactionXDR(xdr: string, networkPassphrase = StellarSdk.Networks.TESTNET): Promise<string> {
  const keypair = await ensureLocalWalletKeypair();
  const transaction = new StellarSdk.Transaction(xdr, networkPassphrase);
  transaction.sign(keypair);
  return transaction.toEnvelope().toXDR('base64');
}

export async function openExternalWalletGuide(wallet: ExternalWalletName): Promise<string> {
  const scheme = EXTERNAL_WALLET_SCHEMES[wallet];
  const fallback = EXTERNAL_WALLET_FALLBACK_URLS[wallet];

  try {
    const canOpenApp = await Linking.canOpenURL(scheme);
    const targetUrl = canOpenApp ? scheme : fallback;
    await Linking.openURL(targetUrl);
    return targetUrl;
  } catch (error) {
    throw new Error(`Could not open ${EXTERNAL_WALLET_LABELS[wallet]} wallet. Please install it or use the built-in mobile wallet.`);
  }
}

// ---------------------------------------------------------------------------
// Wallet management: reveal, import, and wipe (#553)
// ---------------------------------------------------------------------------

/**
 * Return the secret seed for the active wallet.
 * The caller MUST gate this behind a biometric prompt — seeds are never
 * logged, never sent to a backend, and never written outside SecureStore.
 */
export async function revealWalletSeed(): Promise<string> {
  const seed = await getSecureItem(WALLET_SEED_KEY);
  if (!seed) throw new Error('No wallet found.');
  return seed;
}

/**
 * Import an existing wallet from a Stellar secret seed.
 * Validates the seed format, overwrites the current wallet, and clears any
 * stale session so the user must re-authenticate with the new key.
 */
export async function importWalletFromSeed(secretSeed: string): Promise<StellarSdk.Keypair> {
  const keypair = StellarSdk.Keypair.fromSecret(secretSeed);

  // Persist the new keypair
  await saveSecureItem(WALLET_SEED_KEY, keypair.secret());
  await saveSecureItem(WALLET_ADDRESS_KEY, keypair.publicKey());

  // Wipe the session so the user re-authenticates with the new address
  await clearSession();

  return keypair;
}

/**
 * Remove the wallet keypair and wipe the session.
 * This is irreversible — the user must create or import a new wallet.
 */
export async function removeWallet(): Promise<void> {
  await deleteSecureItem(WALLET_SEED_KEY);
  await deleteSecureItem(WALLET_ADDRESS_KEY);
  await clearSession();
}
