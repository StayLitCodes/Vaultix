import axios, {
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from 'axios';
import { getAccessToken, getRefreshToken, setTokens } from '../utils/token';
import { clearTokens } from '../utils/token';

const API_URL = process.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
  // Send cookies (e.g. httpOnly session/refresh cookies) with cross-origin
  // requests, in addition to the bearer token attached below.
  withCredentials: true,
});

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface WindowWithLocation {
  location: {
    href: string;
  };
}

// 🔄 RESPONSE INTERCEPTOR (Refresh Flow)
// Module-level flag so that if multiple requests 401 around the same time,
// only one of them actually triggers a token refresh; the rest just fail
// fast instead of firing duplicate refresh calls.
let isRefreshing = false;

// Attach the current access token to every outgoing request, if present.
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error: AxiosError): Promise<never> => {
    return Promise.reject(new Error(error.message));
  },
);

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError): Promise<AxiosResponse> => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        // A refresh is already in flight for another request. This request
        // is simply rejected rather than queued to retry after the refresh
        // completes, so callers hitting this branch will see a failure even
        // though the token may be valid again moments later.
        return Promise.reject(error);
      }

      // Mark this request so it won't be retried a second time if the
      // refreshed token somehow still gets a 401 (avoids infinite loop).
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = getRefreshToken();

        // Use the raw axios instance (not `api`) so this call doesn't go
        // through these same interceptors and risk recursive refresh logic.
        const response = await axios.post<AuthTokens>(
          `${API_URL}/auth/refresh`,
          { refreshToken },
        );

        const { accessToken, refreshToken: newRefreshToken } = response.data;

        // Persist the newly issued token pair for future requests.
        setTokens(accessToken, newRefreshToken);

        // Patch the Authorization header on the original failed request
        // with the fresh token before replaying it.
        if (originalRequest.headers) {
          originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        }

        // Replay the original request now that we have a valid token.
        return api(originalRequest);
      } catch (err) {
        // Refresh itself failed (e.g. refresh token expired/invalid):
        // treat this as a full logout — clear stored tokens and bounce
        // the user to the login page.
        const error = err instanceof Error ? err : new Error(String(err));
        clearTokens();
        if (typeof globalThis.window !== 'undefined') {
          const win = globalThis.window as WindowWithLocation;
          win.location.href = '/login';
        }
        return Promise.reject(error);
      } finally {
        // Always release the lock, whether refresh succeeded or failed,
        // so future 401s can trigger a new refresh attempt.
        isRefreshing = false;
      }
    }

    // Any error that isn't a retryable 401 is passed through as-is.
    return Promise.reject(new Error(error.message));
  },
);

export default api;