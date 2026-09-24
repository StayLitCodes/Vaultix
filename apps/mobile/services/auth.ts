/**
 * Route-guard + access-mode helpers.
 *
 * #549/#550 — authentication is now backed by a real JWT held in the SecureStore
 * session layer (`services/session.ts`). "Explore without wallet" puts the app
 * into an explicit, in-memory-only guest mode: routes stay reachable but every
 * wallet-backed action is gated behind `requireWallet`.
 */
import {
  clearSession,
  getSession,
  isSessionHydrated,
  subscribeToSession,
} from './session';
import { clearEscrowCache } from '../services/cache/escrowCache';
import { clearAllCache } from './cache/cacheKeys';

type RedirectTarget = {
  pathname: string;
  params?: Record<string, string>;
};

type Router = {
  replace: (target: string | { pathname: string; params?: Record<string, string> }) => void;
};

export type AccessMode = 'authenticated' | 'guest' | 'anonymous';

let pendingRedirect: RedirectTarget | null = null;
let guestMode = false;

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

/** Subscribe to any change in access mode (sign-in, sign-out, guest toggle). */
export function subscribeToAuth(listener: () => void): () => void {
  listeners.add(listener);
  const unsubscribeSession = subscribeToSession(listener);
  return () => {
    listeners.delete(listener);
    unsubscribeSession();
  };
}

export function isAuthenticated(): boolean {
  return Boolean(getSession());
}

export function isGuest(): boolean {
  return !isAuthenticated() && guestMode;
}

export function getAccessMode(): AccessMode {
  if (isAuthenticated()) return 'authenticated';
  if (guestMode) return 'guest';
  return 'anonymous';
}

/** Enter read-only mode from the "Explore without wallet" action. */
export function enterGuestMode(): void {
  if (guestMode) return;
  guestMode = true;
  notify();
}

export function exitGuestMode(): void {
  if (!guestMode) return;
  guestMode = false;
  notify();
}

/** Drop the JWT pair and any guest flag, returning the app to anonymous. */
export async function signOut(): Promise<void> {
  guestMode = false;
  await clearSession();
  await clearEscrowCache();
  notify();
}

/**
 * Full logout: clears the JWT pair, wallet address, cached escrow data,
 * and any guest flag (#549). Use this when the user explicitly signs out.
 */
export async function logout(): Promise<void> {
  guestMode = false;
  await clearSession();
  await clearAllCache();
  notify();
}

/**
 * Guard for browsable routes. Guests are allowed through in read-only mode;
 * only fully anonymous users are bounced back to the welcome screen.
 * Returns false (without redirecting) while the session is still hydrating so
 * a cold start does not flash the welcome screen over a valid session.
 */
export function requireAuth(router: Router, redirectTarget: RedirectTarget): boolean {
  if (!isSessionHydrated()) return false;
  if (isAuthenticated() || guestMode) return true;

  pendingRedirect = redirectTarget;
  router.replace('/');
  return false;
}

/**
 * Guard for actions that need a real signature (create/fund/release/dispute).
 * Guests are sent to the welcome screen to connect a wallet first.
 */
export function requireWallet(router: Router, redirectTarget: RedirectTarget): boolean {
  if (isAuthenticated()) return true;

  pendingRedirect = redirectTarget;
  router.replace('/');
  return false;
}

export function consumePendingRedirect(): RedirectTarget | null {
  const redirect = pendingRedirect;
  pendingRedirect = null;
  return redirect;
}

/** Test-only: reset module state between cases. */
export function __resetAuthForTests(): void {
  pendingRedirect = null;
  guestMode = false;
  listeners.clear();
}
