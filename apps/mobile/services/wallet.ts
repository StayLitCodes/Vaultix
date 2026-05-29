import { Keypair } from '@stellar/stellar-sdk';
import { Linking, Platform } from 'react-native';

export interface WalletOption {
  id: string;
  name: string;
  description: string;
  recommended: boolean;
  deepLinkScheme: string;
  fallbackUrl: string;
  supportedPlatforms: string[];
}

export interface WalletCallbackData {
  publicKey: string;
  signature: string;
  challenge: string;
}

export interface WalletConnectionState {
  status: 'idle' | 'connecting' | 'waiting' | 'connected' | 'error';
  walletId: string;
  publicKey?: string;
  signature?: string;
  challenge?: string;
  message: string;
}

export const WALLET_OPTIONS: WalletOption[] = [
  {
    id: 'lobstr',
    name: 'LOBSTR',
    description: 'Native mobile wallet with reliable deep-link prompts for signing.',
    recommended: true,
    deepLinkScheme: 'lobstr://',
    fallbackUrl: 'https://lobstr.co/',
    supportedPlatforms: ['iOS', 'Android'],
  },
];

export const WALLET_CALLBACK_SCHEME = 'vaultix';
export const WALLET_CALLBACK_PATH = 'wallet/callback';

export function createChallenge(walletId: string): string {
  const nonce = Math.random().toString(36).slice(2, 10);
  const timestamp = Date.now();
  return `Vaultix mobile wallet connect (${walletId}) ${nonce} ${timestamp}`;
}

export function extractWalletCallback(url: string): WalletCallbackData | null {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== `${WALLET_CALLBACK_SCHEME}:`) {
      return null;
    }
    const expectedPath = `/${WALLET_CALLBACK_PATH}`;
    if (parsedUrl.pathname !== expectedPath) {
      return null;
    }

    const publicKey = parsedUrl.searchParams.get('publicKey');
    const signature = parsedUrl.searchParams.get('signature');
    const challenge = parsedUrl.searchParams.get('challenge');

    if (!publicKey || !signature || !challenge) {
      return null;
    }

    return { publicKey, signature, challenge };
  } catch {
    return null;
  }
}

export function verifyWalletSignature(publicKey: string, challenge: string, signature: string): boolean {
  try {
    const verifier = Keypair.fromPublicKey(publicKey);
    const normalizedSignature = normalizeSignature(signature);
    const challengeBytes = Buffer.from(challenge, 'utf8');
    return verifier.verify(challengeBytes, normalizedSignature);
  } catch {
    return false;
  }
}

export function normalizeSignature(signature: string): Buffer {
  const trimmed = signature.trim();
  const upper = trimmed.toUpperCase();

  if (/^[0-9A-F]{64,}$/.test(upper)) {
    return Buffer.from(trimmed, 'hex');
  }

  const base64Candidate = trimmed.replace(/\s+/g, '');
  if (/^[A-Za-z0-9+/]+=*$/.test(base64Candidate)) {
    try {
      return Buffer.from(base64Candidate, 'base64');
    } catch {
      return Buffer.from(trimmed, 'utf8');
    }
  }

  return Buffer.from(trimmed, 'utf8');
}

export async function openWallet(wallet: WalletOption, challenge: string): Promise<void> {
  const canOpen = await Linking.canOpenURL(wallet.deepLinkScheme);
  if (canOpen) {
    await Linking.openURL(wallet.deepLinkScheme);
    return;
  }

  const fallback = wallet.fallbackUrl;
  await Linking.openURL(fallback);
}

export function supportsWalletOnPlatform(wallet: WalletOption): boolean {
  if (Platform.OS === 'ios') {
    return wallet.supportedPlatforms.includes('iOS');
  }
  return wallet.supportedPlatforms.includes('Android');
}
