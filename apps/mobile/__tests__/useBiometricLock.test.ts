import { renderHook, act } from '@testing-library/react-native';
import { useBiometricLock } from '../hooks/useBiometricLock';
import * as LocalAuthentication from 'expo-local-authentication';
import { getSecureItem, saveSecureItem } from '../utils/secureStore';

jest.mock('expo-local-authentication');
jest.mock('../utils/secureStore', () => ({
  getSecureItem: jest.fn(() => Promise.resolve('false')),
  saveSecureItem: jest.fn(() => Promise.resolve()),
}));

// Flush all microtasks + pending React state updates.
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('useBiometricLock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSecureItem as jest.Mock).mockResolvedValue('false');
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
  });

  it('starts locked + initializing, then resolves to unlocked when no preference', async () => {
    const { result } = renderHook(() => useBiometricLock());

    // Before the SecureStore read resolves: locked, not yet initialized.
    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.isInitializing).toBe(true);

    await flush();

    // Preference is 'false' -> no lock configured -> unlocked after init.
    expect(result.current.isInitializing).toBe(false);
    expect(result.current.isEnabled).toBe(false);
    expect(result.current.isUnlocked).toBe(true);
    expect(result.current.isSupported).toBe(true);
    expect(result.current.isEnrolled).toBe(true);
  });

  it('stays locked after init when biometric preference is enabled', async () => {
    (getSecureItem as jest.Mock).mockResolvedValue('true');

    const { result } = renderHook(() => useBiometricLock());
    await flush();

    expect(result.current.isInitializing).toBe(false);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.isUnlocked).toBe(false);
  });

  it('forceDisableBiometric clears lock when authenticateAsync always fails and hardware is gone (#721)', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(false);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(false);
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({
      success: false,
      error: 'not_available',
    });
    (getSecureItem as jest.Mock).mockResolvedValue('true');

    const { result } = renderHook(() => useBiometricLock());
    await flush();

    let outcome: { success: boolean; method: string } | undefined;
    await act(async () => {
      outcome = await result.current.forceDisableBiometric();
    });

    expect(outcome?.success).toBe(true);
    expect(outcome?.method).toBe('forced');
    expect(saveSecureItem).toHaveBeenCalledWith('biometric_enabled', 'false');
    expect(result.current.isEnabled).toBe(false);
    expect(result.current.isUnlocked).toBe(true);
  });

  it('disableBiometric still works via forced path when not enrolled', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(false);
    (getSecureItem as jest.Mock).mockResolvedValue('true');

    const { result } = renderHook(() => useBiometricLock());
    await flush();

    let ok = false;
    await act(async () => {
      ok = await result.current.disableBiometric();
    });
    expect(ok).toBe(true);
    expect(saveSecureItem).toHaveBeenCalledWith('biometric_enabled', 'false');
  });

  it('authenticate unlocks after successful biometric prompt when locked', async () => {
    (getSecureItem as jest.Mock).mockResolvedValue('true');
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({
      success: true,
    });

    const { result } = renderHook(() => useBiometricLock());
    await flush();
    expect(result.current.isUnlocked).toBe(false);

    await act(async () => {
      await result.current.authenticate();
    });

    expect(result.current.isUnlocked).toBe(true);
  });

  it('never renders real content before the preference check resolves (cold start)', async () => {
    (getSecureItem as jest.Mock).mockResolvedValue('true');

    const { result } = renderHook(() => useBiometricLock());

    // While initializing, the hook reports locked — consumers must not mount
    // the app Stack until isInitializing flips to false AND isUnlocked is true.
    expect(result.current.isInitializing).toBe(true);
    expect(result.current.isUnlocked).toBe(false);

    await flush();

    expect(result.current.isInitializing).toBe(false);
    expect(result.current.isUnlocked).toBe(false);
  });
});