import axios, { AxiosError } from 'axios';
import { getAccessToken, getRefreshToken, setTokens, } from '../utils/token';
import { clearTokens } from '../utils/token';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      VITE_API_URL?: string;
    }
  }
}

const api = axios.create({
  baseURL: process.env.VITE_API_URL || 'http://localhost:3001',
  withCredentials: true,
});



api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);


// 🔄 RESPONSE INTERCEPTOR (Refresh Flow)
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });

  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest: any = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = getRefreshToken();

        const response = await axios.post(
          `${process.env.VITE_API_URL}/auth/refresh`,
          { refreshToken },
        );

        const { accessToken, refreshToken: newRefreshToken } = response.data;

        setTokens(accessToken, newRefreshToken);

        processQueue(null, accessToken);

        originalRequest.headers['Authorization'] = 'Bearer ' + accessToken;

        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        clearTokens();
        if (typeof globalThis.window !== 'undefined') {
          globalThis.window.location.href = '/login';
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;