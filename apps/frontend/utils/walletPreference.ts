// Closes #475: remember the user's last connected wallet (Freighter,
// Albedo, or Lobstr) across sessions. Starter localStorage helpers;
// wiring the auto-reconnect prompt and Settings-page preference UI is a
// follow-up.

export type WalletProviderId = 'freighter' | 'albedo' | 'lobstr';

const WALLET_PREFERENCE_KEY = 'vaultix_last_wallet';

export function saveWalletPreference(provider: WalletProviderId): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(WALLET_PREFERENCE_KEY, provider);
}

export function getWalletPreference(): WalletProviderId | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(WALLET_PREFERENCE_KEY);
  return value === 'freighter' || value === 'albedo' || value === 'lobstr' ? value : null;
}

export function clearWalletPreference(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(WALLET_PREFERENCE_KEY);
}
