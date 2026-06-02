import AsyncStorage from
  "@react-native-async-storage/async-storage";

import { CACHE_KEYS } from "./cacheKeys";

export async function cacheEscrowDetail(
  id: string,
  data: unknown
) {
  const payload = {
    updatedAt: Date.now(),
    data,
  };

  await AsyncStorage.setItem(
    CACHE_KEYS.escrowDetail(id),
    JSON.stringify(payload)
  );
}

export async function getCachedEscrowDetail(
  id: string
) {
  const raw = await AsyncStorage.getItem(
    CACHE_KEYS.escrowDetail(id)
  );

  if (!raw) return null;

  return JSON.parse(raw);
}