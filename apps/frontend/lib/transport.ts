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

    constructor() {
        const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.vaultix.io/v1';
        
        this.client = axios.create({
            baseURL: baseURL.replace(/\/+$/, ''), // Normalize trailing slashes
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Request interceptor: attach unified Bearer token
        this.client.interceptors.request.use(
            (config) => {
                if (typeof window !== 'undefined') {
                    const token = localStorage.getItem('vaultix_auth_token');
                    if (token) {
                        config.headers.Authorization = `Bearer ${token}`;
                    }
                }
                // Handle FormData / multipart without forcing application/json
                if (config.data instanceof FormData) {
                    delete config.headers['Content-Type'];
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response interceptor: handle 204 responses and typed error structures
        this.client.interceptors.response.use(
            (response: AxiosResponse) => {
                if (response.status === 204) {
                    return null as any;
                }
                return response.data;
            },
            (error) => {
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