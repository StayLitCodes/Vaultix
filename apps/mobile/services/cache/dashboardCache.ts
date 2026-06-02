import AsyncStorage from
  "@react-native-async-storage/async-storage";

import { CACHE_KEYS } from "./cacheKeys";

export async function cacheDashboardData(
  data: unknown
) {
  const payload = {
    updatedAt: Date.now(),
    data,
  };

  await AsyncStorage.setItem(
    CACHE_KEYS.DASHBOARD,
    JSON.stringify(payload)
  );
}

export async function getCachedDashboardData() {
  const raw = await AsyncStorage.getItem(
    CACHE_KEYS.DASHBOARD
  );

  if (!raw) return null;

  return JSON.parse(raw);
}