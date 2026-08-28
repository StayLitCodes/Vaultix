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
      await AsyncStorage.removeMany(cacheKeys);
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}