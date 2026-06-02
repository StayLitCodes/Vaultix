import { deleteSecureItem, getSecureItem, saveSecureItem } from '../utils/secureStore';

type RedirectTarget = {
  pathname: string;
  params?: Record<string, string>;
};

const AUTH_TOKEN_KEY = 'vaultix-auth-token';
const WALLET_ADDRESS_KEY = 'vaultix-wallet-address';

let pendingRedirect: RedirectTarget | null = null;

export async function initializeAuthState() {
  const token = await getSecureItem(AUTH_TOKEN_KEY);
  const address = await getSecureItem(WALLET_ADDRESS_KEY);
  if (token) {
    (global as Record<string, unknown>).__authToken = token;
  }
  if (address) {
    (global as Record<string, unknown>).__walletAddress = address;
  }
}

export function isAuthenticated() {
  return Boolean((global as Record<string, unknown>).__authToken);
}

export function getWalletAddress() {
  return (global as Record<string, unknown>).__walletAddress as string | undefined;
}

export async function setAuthState(token: string, walletAddress: string) {
  await saveSecureItem(AUTH_TOKEN_KEY, token);
  await saveSecureItem(WALLET_ADDRESS_KEY, walletAddress);
  (global as Record<string, unknown>).__authToken = token;
  (global as Record<string, unknown>).__walletAddress = walletAddress;
}

export async function clearAuthState() {
  await deleteSecureItem(AUTH_TOKEN_KEY);
  await deleteSecureItem(WALLET_ADDRESS_KEY);
  delete (global as Record<string, unknown>).__authToken;
  delete (global as Record<string, unknown>).__walletAddress;
}

export function requireAuth(
  router: { replace: (target: string | { pathname: string; params?: Record<string, string> }) => void },
  redirectTarget: RedirectTarget,
) {
  if (isAuthenticated()) {
    return true;
  }

  pendingRedirect = redirectTarget;
  router.replace('/');
  return false;
}

export function consumePendingRedirect(): RedirectTarget | null {
  const redirect = pendingRedirect;
  pendingRedirect = null;
  return redirect;
}
