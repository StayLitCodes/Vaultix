/**
 * #550 — SecureStore-backed session layer.
 *
 * Holds the JWT pair issued by `POST /auth/verify` plus the wallet address it
 * was issued for. The tokens live in `expo-secure-store` (Keychain / Keystore)
 * so they survive app restarts without ever touching AsyncStorage or globals.
 *
 * A synchronous in-memory mirror is kept so request interceptors and route
 * guards can read the token without awaiting; call `hydrateSession()` once at
 * startup to populate it.
 */
import { deleteSecureItem, getSecureItem, saveSecureItem } from '../utils/secureStore';

export const ACCESS_TOKEN_KEY = 'vaultix-access-token';
const REFRESH_TOKEN_KEY = 'vaultix-refresh-token';
const SESSION_ADDRESS_KEY = 'vaultix-session-address';

export interface Session {
  accessToken: string;
  refreshToken: string;
  walletAddress: string;
}

let current: Session | null = null;
let hydrated = false;
let hydration: Promise<Session | null> | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

/** Subscribe to session changes. Returns an unsubscribe function. */
export function subscribeToSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Synchronous read of the active session. Null until hydrated or signed in. */
export function getSession(): Session | null {
  return current;
}

export function getAccessToken(): string | null {
  return current?.accessToken ?? null;
}

export function getSessionAddress(): string | null {
  return current?.walletAddress ?? null;
}

/**
 * Read the access token directly from SecureStore, bypassing the in-memory
 * mirror. Used by the axios interceptor as a fallback when the session has
 * not yet been hydrated (#549).
 */
export async function getSecureAccessToken(): Promise<string | null> {
  return getSecureItem(ACCESS_TOKEN_KEY);
}

export function isSessionHydrated(): boolean {
  return hydrated;
}

/**
 * Load a previously persisted session from SecureStore into memory.
 * Safe to call repeatedly — concurrent calls share one read.
 */
export function hydrateSession(): Promise<Session | null> {
  if (hydrated) return Promise.resolve(current);
  if (hydration) return hydration;

  hydration = (async () => {
    const [accessToken, refreshToken, walletAddress] = await Promise.all([
      getSecureItem(ACCESS_TOKEN_KEY),
      getSecureItem(REFRESH_TOKEN_KEY),
      getSecureItem(SESSION_ADDRESS_KEY),
    ]);

    current = accessToken && refreshToken && walletAddress
      ? { accessToken, refreshToken, walletAddress }
      : null;
    hydrated = true;
    hydration = null;
    notify();
    return current;
  })();

  return hydration;
}

/** Persist a freshly issued session and make it active. */
export async function saveSession(session: Session): Promise<void> {
  await Promise.all([
    saveSecureItem(ACCESS_TOKEN_KEY, session.accessToken),
    saveSecureItem(REFRESH_TOKEN_KEY, session.refreshToken),
    saveSecureItem(SESSION_ADDRESS_KEY, session.walletAddress),
  ]);
  current = session;
  hydrated = true;
  notify();
}

/** Wipe the session from memory and SecureStore (sign out / 401 handling). */
export async function clearSession(): Promise<void> {
  current = null;
  hydrated = true;
  notify();
  await Promise.all([
    deleteSecureItem(ACCESS_TOKEN_KEY),
    deleteSecureItem(REFRESH_TOKEN_KEY),
    deleteSecureItem(SESSION_ADDRESS_KEY),
  ]);
}

/** Test-only: reset module state between cases. */
export function __resetSessionForTests(): void {
  current = null;
  hydrated = false;
  hydration = null;
  listeners.clear();
}
