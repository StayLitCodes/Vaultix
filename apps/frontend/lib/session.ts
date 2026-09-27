import { apiClient } from "./api-client";
import { walletAddressFromAccessToken } from "./jwt-utils";

const SESSION_WALLET_KEY = "vaultix_session_wallet";

export interface Session {
  accessToken: string;
  refreshToken: string;
  walletAddress: string;
}

let current: Session | null = null;
let hydrated = false;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeToSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSession(): Session | null {
  return current;
}

export function getAccessToken(): string | null {
  return current?.accessToken ?? null;
}

export function getSessionWalletAddress(): string | null {
  return current?.walletAddress ?? null;
}

export function isSessionHydrated(): boolean {
  return hydrated;
}

function readPersistedSession(): Session | null {
  if (typeof window === "undefined") return null;

  const accessToken = window.localStorage.getItem("vaultix_token");
  const refreshToken = window.localStorage.getItem("vaultix_refresh_token");
  if (!accessToken || !refreshToken) return null;

  let walletAddress = window.localStorage.getItem(SESSION_WALLET_KEY);
  if (!walletAddress) {
    walletAddress = walletAddressFromAccessToken(accessToken);
    if (walletAddress) {
      window.localStorage.setItem(SESSION_WALLET_KEY, walletAddress);
    }
  }

  if (!walletAddress) return null;

  return { accessToken, refreshToken, walletAddress };
}

/** Load persisted session into memory (safe to call once at startup). */
export function hydrateSession(): Session | null {
  if (hydrated) return current;

  current = readPersistedSession();
  if (current) {
    apiClient.applySessionToken(current.accessToken);
  }
  hydrated = true;
  return current;
}

export function saveSession(session: Session): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("vaultix_token", session.accessToken);
    window.localStorage.setItem("vaultix_refresh_token", session.refreshToken);
    window.localStorage.setItem(SESSION_WALLET_KEY, session.walletAddress);
  }
  current = session;
  hydrated = true;
  apiClient.applySessionToken(session.accessToken);
  notify();
  window.dispatchEvent(new CustomEvent("auth:session-saved"));
}

/** Clear JWT session and cancel in-flight API requests for the previous identity. */
export function clearSession(): void {
  apiClient.cancelPendingRequests();
  current = null;
  hydrated = true;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("vaultix_token");
    window.localStorage.removeItem("vaultix_refresh_token");
    window.localStorage.removeItem("vaultix_login_time");
    window.localStorage.removeItem(SESSION_WALLET_KEY);
    document.cookie =
      "vaultix_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  }
  apiClient.applySessionToken(null);
  notify();
  window.dispatchEvent(new CustomEvent("auth:session-cleared"));
}

export function isAuthenticatedForWallet(
  walletPublicKey: string | null | undefined,
): boolean {
  if (!walletPublicKey) return false;
  const session = getSession();
  return session?.walletAddress === walletPublicKey;
}

/** Test-only: reset module state between cases. */
export function __resetSessionForTests(): void {
  current = null;
  hydrated = false;
  listeners.clear();
}

if (typeof window !== "undefined") {
  window.addEventListener("auth:access-token-refreshed", (event) => {
    const accessToken = (event as CustomEvent<{ accessToken?: string }>).detail
      ?.accessToken;
    if (current && accessToken) {
      current = { ...current, accessToken };
      window.localStorage.setItem("vaultix_token", accessToken);
      notify();
    }
  });
}
