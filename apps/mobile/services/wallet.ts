import { Linking } from 'react-native';
import * as StellarSdk from '@stellar/stellar-sdk';
import { deleteSecureItem, getSecureItem, saveSecureItem } from '../utils/secureStore';

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

export async function signMessage(message: string): Promise<string> {
  const keypair = await ensureLocalWalletKeypair();
  const encoded = new TextEncoder().encode(message);
  const signature = keypair.sign(encoded as unknown as Buffer);
  return Array.from(signature)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
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
