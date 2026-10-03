/**
 * #764 — "Disconnect Wallet" must go through the same shared logout routine as
 * "Sign out", so it also wipes the dashboard cache, every `escrow_detail_*`
 * entry and the guest-mode flag.
 */
import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockStore = new Map<string, string>();
const mockAsyncStore = new Map<string, string>();

jest.mock('../utils/secureStore', () => ({
  saveSecureItem: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  getSecureItem: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  deleteSecureItem: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async (key: string, value: string) => {
    mockAsyncStore.set(key, value);
  }),
  getItem: jest.fn(async (key: string) => mockAsyncStore.get(key) ?? null),
  getAllKeys: jest.fn(async () => Array.from(mockAsyncStore.keys())),
  multiRemove: jest.fn(async (keys: string[]) => {
    keys.forEach((key) => mockAsyncStore.delete(key));
  }),
  removeItem: jest.fn(async (key: string) => {
    mockAsyncStore.delete(key);
  }),
}));

const replace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace, push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  authenticateAsync: jest.fn(async () => ({ success: true })),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(async () => true),
  getStringAsync: jest.fn(async () => ''),
}));

jest.mock('../services/wallet', () => ({
  revealWalletSeed: jest.fn(),
  importWalletFromSeed: jest.fn(),
  removeWallet: jest.fn(),
}));

const resetSessionExpiryGate = jest.fn();
jest.mock('../services/api', () => ({
  resetSessionExpiryGate: (...args: unknown[]) => resetSessionExpiryGate(...args),
}));

jest.mock('../hooks/useBiometricLock', () => ({
  useBiometricLock: () => ({
    isSupported: true,
    isEnrolled: true,
    isEnabled: false,
    enableBiometric: jest.fn(),
    disableBiometric: jest.fn(),
  }),
}));

import SettingsScreen from '../app/(tabs)/settings';
import { cacheEscrowDetail } from '../services/cache/escrowCache';
import { saveSession, __resetSessionForTests } from '../services/session';
import { enterGuestMode, isGuest, __resetAuthForTests } from '../services/auth';

const SESSION = {
  accessToken: 'jwt.access.token',
  refreshToken: 'jwt.refresh.token',
  walletAddress: 'GCEXAMPLEADDRESSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
};

/** Presses the destructive button of the first Alert raised by the screen. */
function confirmDestructiveAction(): Promise<void> {
  const calls = (Alert.alert as jest.Mock).mock.calls;
  const lastCall = calls[calls.length - 1];
  const buttons = lastCall[2] as Array<{ style?: string; onPress?: () => void | Promise<void> }>;
  const destructive = buttons.find((b) => b.style === 'destructive');
  if (!destructive?.onPress) throw new Error('no destructive action on the alert');
  return Promise.resolve(destructive.onPress());
}

describe('SettingsScreen disconnect wallet (#764)', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    replace.mockClear();
    mockStore.clear();
    mockAsyncStore.clear();
    __resetSessionForTests();
    __resetAuthForTests();
    await saveSession(SESSION);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => alertSpy.mockRestore());

  async function seedCache() {
    mockAsyncStore.set('dashboard_cache', JSON.stringify({ escrows: ['stale'] }));
    await cacheEscrowDetail('escrow-1', { id: 'escrow-1' });
    await cacheEscrowDetail('escrow-2', { id: 'escrow-2' });
    mockAsyncStore.set('unrelated_key', 'keep me');
  }

  it('clears the dashboard cache and every escrow_detail_* entry', async () => {
    await seedCache();
    render(<SettingsScreen />);

    fireEvent.press(screen.getByLabelText('Disconnect Wallet'));
    await confirmDestructiveAction();

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));

    expect(mockAsyncStore.has('dashboard_cache')).toBe(false);
    expect(mockAsyncStore.has('escrow_detail_escrow-1')).toBe(false);
    expect(mockAsyncStore.has('escrow_detail_escrow-2')).toBe(false);
    expect(mockAsyncStore.has('escrow_lru_index')).toBe(false);
    // Unrelated AsyncStorage data is left alone.
    expect(mockAsyncStore.has('unrelated_key')).toBe(true);
  });

  it('wipes the session tokens and resets guest mode', async () => {
    // No session, so guest mode is the active access mode.
    __resetSessionForTests();
    enterGuestMode();
    expect(isGuest()).toBe(true);

    render(<SettingsScreen />);
    fireEvent.press(screen.getByLabelText('Disconnect Wallet'));
    await confirmDestructiveAction();

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(isGuest()).toBe(false);
    expect(mockStore.size).toBe(0);
  });

  it('produces exactly the same side effects as "Sign out"', async () => {
    // "Sign out"
    await seedCache();
    const signOutRender = render(<SettingsScreen />);
    fireEvent.press(screen.getByLabelText('Sign out of Vaultix'));
    await confirmDestructiveAction();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    const afterSignOut = Array.from(mockAsyncStore.keys()).sort();
    signOutRender.unmount();

    // "Disconnect Wallet" from an identical starting state
    __resetSessionForTests();
    __resetAuthForTests();
    await saveSession(SESSION);
    await seedCache();
    render(<SettingsScreen />);
    fireEvent.press(screen.getByLabelText('Disconnect Wallet'));
    await confirmDestructiveAction();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    const afterDisconnect = Array.from(mockAsyncStore.keys()).sort();

    expect(afterDisconnect).toEqual(afterSignOut);
  });

  it('also resets the session expiry gate', async () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByLabelText('Disconnect Wallet'));
    await confirmDestructiveAction();

    await waitFor(() => expect(resetSessionExpiryGate).toHaveBeenCalled());
  });
});
