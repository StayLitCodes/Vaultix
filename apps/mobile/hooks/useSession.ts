/**
 * #549/#550 — React binding over the SecureStore session layer.
 * Re-renders whenever the access mode changes (sign-in, sign-out, guest toggle).
 */
import { useCallback, useEffect, useState } from 'react';
import {
  AccessMode,
  exitGuestMode,
  getAccessMode,
  logout as logoutInternal,
  subscribeToAuth,
} from '../services/auth';
import { getSession, hydrateSession, isSessionHydrated, Session } from '../services/session';

interface UseSessionResult {
  session: Session | null;
  walletAddress: string | null;
  accessMode: AccessMode;
  isAuthenticated: boolean;
  isGuest: boolean;
  /** False until the persisted session has been read back from SecureStore. */
  isHydrated: boolean;
  signOut: () => Promise<void>;
  exitGuestMode: () => void;
}

export function useSession(): UseSessionResult {
  const [, forceRender] = useState(0);
  const [isHydrated, setIsHydrated] = useState(isSessionHydrated);

  useEffect(() => {
    const unsubscribe = subscribeToAuth(() => forceRender((n) => n + 1));
    let cancelled = false;

    hydrateSession().finally(() => {
      if (!cancelled) setIsHydrated(true);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    await logoutInternal();
  }, []);

  const accessMode = getAccessMode();
  const session = getSession();

  return {
    session,
    walletAddress: session?.walletAddress ?? null,
    accessMode,
    isAuthenticated: accessMode === 'authenticated',
    isGuest: accessMode === 'guest',
    isHydrated,
    signOut,
    exitGuestMode,
  };
}
