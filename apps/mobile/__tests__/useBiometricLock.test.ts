import { renderHook, act } from '@testing-library/react-native';
import { useBiometricLock } from '../hooks/useBiometricLock';
import * as LocalAuthentication from 'expo-local-authentication';

jest.mock('expo-local-authentication');
jest.mock('../utils/secureStore', () => ({
  getSecureItem: jest.fn(() => Promise.resolve('false')),
  saveSecureItem: jest.fn(() => Promise.resolve()),
}));

describe('useBiometricLock', () => {
  it('should initialize correctly', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);

    const { result } = renderHook(() => useBiometricLock());
    
    // wait for async effects
    await act(async () => {});

    expect(result.current.isSupported).toBe(true);
    expect(result.current.isEnrolled).toBe(true);
    expect(result.current.isEnabled).toBe(false);
  });
});
