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
let isRefreshing = false;

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
        // If already refreshing, just reject - caller will retry
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = getRefreshToken();

        const response = await axios.post<AuthTokens>(
          `${API_URL}/auth/refresh`,
          { refreshToken },
        );

        const { accessToken, refreshToken: newRefreshToken } = response.data;

        setTokens(accessToken, newRefreshToken);

        if (originalRequest.headers) {
          originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        }

        return api(originalRequest);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        clearTokens();
        if (typeof globalThis.window !== 'undefined') {
          const win = globalThis.window as WindowWithLocation;
          win.location.href = '/login';
        }
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(new Error(error.message));
  },
);

export default api;
