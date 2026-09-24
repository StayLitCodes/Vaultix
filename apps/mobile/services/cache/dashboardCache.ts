import AsyncStorage from
  "@react-native-async-storage/async-storage";

import { CACHE_KEYS } from "./cacheKeys";
import { CACHE_TTL_MS, SCHEMA_VERSION } from "./cacheConfig";

export interface DashboardCacheEntry {
  version: number;
  updatedAt: number;
  expiresAt: number;
  data: unknown;
  stale: boolean;
}

export async function cacheDashboardData(
  data: unknown
) {
  const entry: DashboardCacheEntry = {
    version: SCHEMA_VERSION,
    updatedAt: Date.now(),
    expiresAt: Date.now() + CACHE_TTL_MS,
    data,
    stale: false,
  };

  await AsyncStorage.setItem(
    CACHE_KEYS.DASHBOARD,
    JSON.stringify(entry)
  );
}

export async function getCachedDashboardData() {
  const raw = await AsyncStorage.getItem(
    CACHE_KEYS.DASHBOARD
  );

  if (!raw) return null;

  try {
    const entry = JSON.parse(raw) as DashboardCacheEntry;

    if (entry.version !== SCHEMA_VERSION) {
      await AsyncStorage.removeItem(
        CACHE_KEYS.DASHBOARD
      );
      return null;
    }

    const now = Date.now();
    const stale = now > entry.expiresAt;

    return {
      ...entry,
      stale,
    };
  } catch {
    await AsyncStorage.removeItem(
      CACHE_KEYS.DASHBOARD
    );
    return null;
  }
}

export async function clearDashboardCache() {
  await AsyncStorage.removeItem(
    CACHE_KEYS.DASHBOARD
  );
}
