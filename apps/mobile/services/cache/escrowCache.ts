import AsyncStorage from
  "@react-native-async-storage/async-storage";

import { CACHE_KEYS } from "./cacheKeys";
import {
  CACHE_TTL_MS,
  MAX_ESCROW_CACHE_ENTRIES,
  SCHEMA_VERSION,
} from "./cacheConfig";

export interface EscrowCacheEntry {
  version: number;
  updatedAt: number;
  expiresAt: number;
  data: unknown;
  stale: boolean;
}

const LRU_INDEX_KEY = "escrow_lru_index";

async function updateLruIndex(key: string) {
  const raw = await AsyncStorage.getItem(
    LRU_INDEX_KEY
  );

  let index: string[] = raw
    ? JSON.parse(raw)
    : [];

  index = index.filter((k) => k !== key);
  index.unshift(key);

  const excess = index.splice(
    MAX_ESCROW_CACHE_ENTRIES
  );

  if (excess.length > 0) {
    await AsyncStorage.removeMany(excess);
  }

  await AsyncStorage.setItem(
    LRU_INDEX_KEY,
    JSON.stringify(index)
  );
}

export async function cacheEscrowDetail(
  id: string,
  data: unknown
) {
  const key = CACHE_KEYS.escrowDetail(id);

  const entry: EscrowCacheEntry = {
    version: SCHEMA_VERSION,
    updatedAt: Date.now(),
    expiresAt: Date.now() + CACHE_TTL_MS,
    data,
    stale: false,
  };

  await AsyncStorage.setItem(
    key,
    JSON.stringify(entry)
  );

  await updateLruIndex(key);
}

export async function getCachedEscrowDetail(
  id: string
) {
  const key = CACHE_KEYS.escrowDetail(id);

  const raw = await AsyncStorage.getItem(key);

  if (!raw) return null;

  try {
    const entry = JSON.parse(raw) as EscrowCacheEntry;

    if (entry.version !== SCHEMA_VERSION) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    const now = Date.now();
    const stale = now > entry.expiresAt;

    await updateLruIndex(key);

    return {
      ...entry,
      stale,
    };
  } catch {
    await AsyncStorage.removeItem(key);
    return null;
  }
}

export async function clearEscrowCache() {
  const raw = await AsyncStorage.getItem(
    LRU_INDEX_KEY
  );

  const index: string[] = raw
    ? JSON.parse(raw)
    : [];

  index.push(LRU_INDEX_KEY);

  await AsyncStorage.removeMany(index);
}
