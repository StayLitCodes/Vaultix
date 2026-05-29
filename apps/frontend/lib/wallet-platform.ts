export type WalletPlatform = 'mobile' | 'desktop';

export interface WalletPlatformInfo {
  platform: WalletPlatform;
  recommendedWallet: string;
  orderedWallets: string[];
  limitations: string[];
  recommendationCopy: string;
}

const MOBILE_USER_AGENT_PATTERN = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;

export function detectMobileDevice(userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    if (window.matchMedia('(pointer: coarse)').matches) {
      return true;
    }
  }

  return MOBILE_USER_AGENT_PATTERN.test(userAgent);
}

export function getWalletPlatformInfo(availableWallets: string[], userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''): WalletPlatformInfo {
  const platform: WalletPlatform = detectMobileDevice(userAgent) ? 'mobile' : 'desktop';
  const orderedWallets = [...availableWallets].sort((left, right) => {
    if (platform === 'mobile') {
      if (left === 'albedo') return -1;
      if (right === 'albedo') return 1;
    } else {
      if (left === 'freighter') return -1;
      if (right === 'freighter') return 1;
    }

    return 0;
  });

  const recommendedWallet = platform === 'mobile'
    ? 'albedo'
    : orderedWallets[0] || 'freighter';

  const limitations = platform === 'mobile'
    ? [
        'Albedo is the recommended mobile wallet because it uses browser-based external signing.',
        'Freighter and Lobstr are desktop extension wallets and are not recommended on mobile browsers.',
      ]
    : [
        'Desktop browsers can use Freighter or Lobstr extensions for direct signing.',
        'Albedo remains available as a browser-based fallback when extensions are not installed.',
      ];

  return {
    platform,
    recommendedWallet,
    orderedWallets,
    limitations,
    recommendationCopy: platform === 'mobile'
      ? 'Mobile-first recommended wallet'
      : 'Desktop wallet recommendation',
  };
}
