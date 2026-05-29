import { detectMobileDevice, getWalletPlatformInfo } from './wallet-platform';

describe('wallet platform helpers', () => {
  it('detects mobile devices from user agent strings', () => {
    expect(detectMobileDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15')).toBe(true);
    expect(detectMobileDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36')).toBe(false);
  });

  it('prefers Albedo on mobile and keeps desktop extensions as secondary options', () => {
    const info = getWalletPlatformInfo(['freighter', 'lobstr', 'albedo'], 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15');

    expect(info.platform).toBe('mobile');
    expect(info.recommendedWallet).toBe('albedo');
    expect(info.orderedWallets).toEqual(['albedo', 'freighter', 'lobstr']);
    expect(info.limitations).toEqual(expect.arrayContaining(['Freighter and Lobstr are desktop extension wallets and are not recommended on mobile browsers.']));
  });
});
