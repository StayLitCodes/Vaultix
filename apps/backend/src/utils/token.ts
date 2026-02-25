const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';

// Browser localStorage type
interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const getLocalStorage = (): StorageLike | null => {
  if (typeof globalThis.window !== 'undefined') {
    return globalThis.window.localStorage;
  }
  return null;
};

export const setTokens = (access: string, refresh: string): void => {
  const storage = getLocalStorage();
  if (storage) {
    storage.setItem(ACCESS_KEY, access);
    storage.setItem(REFRESH_KEY, refresh);
  }
};

export const getAccessToken = (): string | null => {
  const storage = getLocalStorage();
  if (storage) {
    return storage.getItem(ACCESS_KEY);
  }
  return null;
};

export const getRefreshToken = (): string | null => {
  const storage = getLocalStorage();
  if (storage) {
    return storage.getItem(REFRESH_KEY);
  }
  return null;
};

export const clearTokens = (): void => {
  const storage = getLocalStorage();
  if (storage) {
    storage.removeItem(ACCESS_KEY);
    storage.removeItem(REFRESH_KEY);
  }
};
