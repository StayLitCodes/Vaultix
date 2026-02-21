const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';

export const setTokens = (access: string, refresh: string) => {
  if (typeof globalThis.window !== 'undefined') {
    globalThis.window.localStorage.setItem(ACCESS_KEY, access);
    globalThis.window.localStorage.setItem(REFRESH_KEY, refresh);
  }
};

export const getAccessToken = () => {
  if (typeof globalThis.window !== 'undefined') {
    return globalThis.window.localStorage.getItem(ACCESS_KEY);
  }
  return null;
};

export const getRefreshToken = () => {
  if (typeof globalThis.window !== 'undefined') {
    return globalThis.window.localStorage.getItem(REFRESH_KEY);
  }
  return null;
};

export const clearTokens = () => {
  if (typeof globalThis.window !== 'undefined') {
    globalThis.window.localStorage.removeItem(ACCESS_KEY);
    globalThis.window.localStorage.removeItem(REFRESH_KEY);
  }
};