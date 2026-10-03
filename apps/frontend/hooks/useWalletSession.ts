'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/app/contexts/WalletContext';
import {
  getSession,
  hydrateSession,
  isAuthenticatedForWallet,
  isSessionHydrated,
  subscribeToSession,
} from '@/lib/session';

/**
 * Session bound to the active wallet. Protected actions should gate on
 * `canPerformProtectedActions`, not merely `activeAccount`.
 */
export function useWalletSession() {
  const { activeAccount } = useWallet();
  const [, renderTick] = useState(0);
  const [hydrated, setHydrated] = useState(isSessionHydrated);

  useEffect(() => {
    hydrateSession();
    setHydrated(true);
    return subscribeToSession(() => renderTick((n) => n + 1));
  }, []);

  const session = getSession();
  const activePublicKey = activeAccount?.publicKey ?? null;
  const canPerformProtectedActions = isAuthenticatedForWallet(activePublicKey);

  return {
    session,
    activePublicKey,
    isHydrated: hydrated,
    isAuthenticated: canPerformProtectedActions,
    canPerformProtectedActions,
    requiresSignIn: Boolean(activePublicKey && !canPerformProtectedActions),
  };
}
