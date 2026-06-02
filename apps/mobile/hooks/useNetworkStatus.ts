/**
 * Network connectivity hook for offline detection.
 * Uses @react-native-community/netinfo when available, falls back to error-based detection.
 */
import { useState, useEffect, useCallback } from 'react';

interface NetInfoState {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: string;
}

const DEFAULT_STATE: NetInfoState = {
  isConnected: null,
  isInternetReachable: null,
  type: 'unknown',
};

let NetInfoModule: typeof import('@react-native-community/netinfo') | null = null;

try {
  NetInfoModule = require('@react-native-community/netinfo');
} catch {
  // NetInfo not installed — we'll use a fallback approach
}

export function useNetworkStatus() {
  const [isOffline, setIsOffline] = useState(false);
  const [connectionType, setConnectionType] = useState<string>('unknown');

  const checkConnectivity = useCallback(async (): Promise<boolean> => {
    if (NetInfoModule) {
      try {
        const state = await NetInfoModule.fetch();
        const connected = state.isConnected ?? true;
        setIsOffline(!connected);
        setConnectionType(state.type ?? 'unknown');
        return connected;
      } catch {
        return true; // Assume online if check fails
      }
    }
    return true; // Assume online if NetInfo not available
  }, []);

  useEffect(() => {
    if (!NetInfoModule) return;

    // Subscribe to connectivity changes
    const unsubscribe = NetInfoModule.addEventListener((state) => {
      const connected = state.isConnected ?? true;
      setIsOffline(!connected);
      setConnectionType(state.type ?? 'unknown');
    });

    // Initial check
    checkConnectivity();

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [checkConnectivity]);

  return {
    isOffline,
    connectionType,
    checkConnectivity,
    /** Mark as offline manually (used when API call fails with network error) */
    markOffline: useCallback(() => setIsOffline(true), []),
    /** Mark as online manually (used when API call succeeds) */
    markOnline: useCallback(() => setIsOffline(false), []),
  };
}
