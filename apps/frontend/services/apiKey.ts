import axios from 'axios';
import { ApiKeyItem } from '@/types/user';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const apiKeyService = {
  async listApiKeys(): Promise<ApiKeyItem[]> {
    const response = await axios.get(`${API_URL}/api-keys`, {
      headers: getAuthHeaders(),
    });
    return response.data as ApiKeyItem[];
  },

  async createApiKey(name: string, rateLimitPerMinute?: number): Promise<ApiKeyItem> {
    const payload = { name } as Record<string, unknown>;
    if (rateLimitPerMinute !== undefined) {
      payload.rateLimitPerMinute = rateLimitPerMinute;
    }

    const response = await axios.post(`${API_URL}/api-keys`, payload, {
      headers: getAuthHeaders(),
    });
    return response.data as ApiKeyItem;
  },

  async revokeApiKey(id: string): Promise<ApiKeyItem> {
    const response = await axios.delete(`${API_URL}/api-keys/${id}`, {
      headers: getAuthHeaders(),
    });
    return response.data as ApiKeyItem;
  },
};
