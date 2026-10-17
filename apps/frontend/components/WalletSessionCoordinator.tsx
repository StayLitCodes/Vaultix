'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@/app/contexts/WalletContext';
import {
  getSession,
  hydrateSession,
  isAuthenticatedForWallet,
  isSessionHydrated,
} from '@/lib/session';
import { resetIdentityState } from '@/lib/wallet-identity';

/**
 * Keeps API session, React Query cache, and WebSocket auth aligned with the
 * active connected wallet. Restored wallet connections do not imply auth.
 */
export function WalletSessionCoordinator() {
  const { activeAccount } = useWallet();
  const queryClient = useQueryClient();
  const lastValidatedWallet = useRef<string | null>(null);

  useEffect(() => {
    hydrateSession();
  }, []);

  useEffect(() => {
    if (!isSessionHydrated()) return;

    const activeKey = activeAccount?.publicKey ?? null;

    if (lastValidatedWallet.current === activeKey) {
      return;
    }

    const previousKey = lastValidatedWallet.current;
    lastValidatedWallet.current = activeKey;

    const session = getSession();
    const walletChanged =
      previousKey !== null && previousKey !== activeKey;

    if (!activeKey) {
      if (session || walletChanged) {
        resetIdentityState(queryClient);
      }
      return;
    }

    if (
      walletChanged ||
      (session !== null && !isAuthenticatedForWallet(activeKey))
    ) {
      resetIdentityState(queryClient);
    }
  }, [activeAccount?.publicKey, queryClient]);

  useEffect(() => {
    const onWalletSwitched = () => {
      resetIdentityState(queryClient);
    };

    const onWalletDisconnected = () => {
      resetIdentityState(queryClient);
    };

    window.addEventListener('wallet:switched', onWalletSwitched);
    window.addEventListener('wallet:disconnected', onWalletDisconnected);

    return () => {
      window.removeEventListener('wallet:switched', onWalletSwitched);
      window.removeEventListener('wallet:disconnected', onWalletDisconnected);
    };
  }, [queryClient]);

  return null;
}
