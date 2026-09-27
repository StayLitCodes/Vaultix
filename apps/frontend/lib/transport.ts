// frontend/src/lib/api/transport.ts
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export interface ApiErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
    meta: {
        timestamp: string;
    };
}

class ApiTransport {
    private client: AxiosInstance;
    private refreshClient: AxiosInstance;
    private isRefreshing = false;
    private refreshPromise: Promise<string | null> | null = null;

    constructor() {
        const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.vaultix.io/v1';
        const normalizedBaseURL = baseURL.replace(/\/+$/, '');

        // Main client for standard requests
        this.client = axios.create({
            baseURL: normalizedBaseURL,
            timeout: 30000,
            headers: { 'Content-Type': 'application/json' },
        });

        // Isolated refresh client to prevent recursive 401 refresh loops
        this.refreshClient = axios.create({
            baseURL: normalizedBaseURL,
            timeout: 30000,
            headers: { 'Content-Type': 'application/json' },
        });

        // Request interceptor: attach access token & support FormData
        this.client.interceptors.request.use(
            (config) => {
                if (typeof window !== 'undefined') {
                    const token = localStorage.getItem('vaultix_auth_token');
                    if (token) {
                        config.headers.Authorization = `Bearer ${token}`;
                    }
                }
                if (config.data instanceof FormData) {
                    delete config.headers['Content-Type'];
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response interceptor: handle 204s and 401 token rotation/replay
        this.client.interceptors.response.use(
            (response: AxiosResponse) => {
                if (response.status === 204) {
                    return null as any;
                }
                return response.data;
            },
            async (error) => {
                const originalRequest = error.config;

                // If error is 401 and we haven't retried yet
                if (error.response?.status === 401 && !originalRequest._retry) {
                    originalRequest._retry = true;

                    try {
                        const newAccessToken = await this.handleTokenRefresh();
                        if (newAccessToken) {
                            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                            return this.client(originalRequest);
                        }
                    } catch (refreshError) {
                        // Refresh failed: clear session state and terminate retries
                        this.clearSession();
                        return Promise.reject(refreshError);
                    }
                }

                const apiError: ApiErrorResponse = error.response?.data || {
                    success: false,
                    error: {
                        code: 'NETWORK_ERROR',
                        message: error.message || 'An unexpected network error occurred.',
                    },
                    meta: { timestamp: new Date().toISOString() },
                };
                return Promise.reject(apiError);
            }
        );
    }

    private async handleTokenRefresh(): Promise<string | null> {
        if (this.isRefreshing && this.refreshPromise) {
            return this.refreshPromise;
        }

        this.isRefreshing = true;
        this.refreshPromise = (async () => {
            try {
                const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('vaultix_refresh_token') : null;
                if (!refreshToken) {
                    throw new Error('No refresh token available.');
                }

                // Use isolated refreshClient to prevent recursive 401 re-entry
                const res = await this.refreshClient.post('/auth/refresh', { refreshToken });
                const { accessToken: newAccess, refreshToken: newRefresh } = res.data.data;

                if (typeof window !== 'undefined') {
                    localStorage.setItem('vaultix_auth_token', newAccess);
                    localStorage.setItem('vaultix_refresh_token', newRefresh); // Persist rotated refresh token
                }

                return newAccess;
            } finally {
                this.isRefreshing = false;
                this.refreshPromise = null;
            }
        })();

        return this.refreshPromise;
    }

    private clearSession() {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('vaultix_auth_token');
            localStorage.removeItem('vaultix_refresh_token');
        }
    }

    public async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
        return this.client.get<any, T>(url, config);
    }

    public async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
        return this.client.post<any, T>(url, data, config);
    }

    public async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
        return this.client.put<any, T>(url, data, config);
    }

    public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
        return this.client.delete<any, T>(url, config);
    }
}

export const api = new ApiTransport();