import AsyncStorage from '@react-native-async-storage/async-storage';

export const CACHE_KEYS = {
  DASHBOARD: "dashboard_cache",

  escrowDetail: (id: string) =>
    `escrow_detail_${id}`,
};

/**
 * Clear all cached data (dashboard, escrow details) from AsyncStorage.
 * Called on logout to ensure no stale data remains (#549).
 */
export async function clearAllCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(
      (key: string) => key === CACHE_KEYS.DASHBOARD || key.startsWith('escrow_detail_')
    );
    if (cacheKeys.length > 0) {
      // `removeMany` never existed on AsyncStorage — the real batch-delete API is
      // `multiRemove`. Calling `removeMany` threw a TypeError that this
      // try/catch swallowed, so post-logout cache clearing silently no-op'd (#763).
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}