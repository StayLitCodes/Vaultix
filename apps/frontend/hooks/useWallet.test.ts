import { renderHook, act } from '@testing-library/react';
import { useWallet } from './useWallet';

describe('useWallet', () => {
  it('should be disconnected initially', () => {
    const { result } = renderHook(() => useWallet());
    expect(result.current.connected).toBe(false);
    expect(result.current.publicKey).toBe(null);
  });

  it('should connect correctly', () => {
    const { result } = renderHook(() => useWallet());

    act(() => {
      result.current.connect();
    });

    expect(result.current.connected).toBe(true);
    expect(result.current.publicKey).toBe('GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H');
  });
});
