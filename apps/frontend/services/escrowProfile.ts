import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const escrowProfileService = {
  async fetchUserEscrows(limit = 1000): Promise<any[]> {
    const response = await axios.get(`${API_URL}/escrows?limit=${limit}`, {
      headers: getAuthHeaders(),
    });
    return response.data?.data ?? response.data ?? [];
  },
};
