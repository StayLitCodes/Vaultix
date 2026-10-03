/**
 * Expo Router linking prefixes (#717).
 * Used so vaultix:// and https://vaultix.app resolve to the same routes.
 */
export const linkingPrefixes = [
  'vaultix://',
  'https://vaultix.app',
  'https://www.vaultix.app',
];

export const linkingConfig = {
  prefixes: linkingPrefixes,
  config: {
    screens: {
      invite: 'invite/:token',
      // escrow detail path depends on file-based routes; keep id segment consistent
      escrow: 'escrow/:id',
    },
  },
};
