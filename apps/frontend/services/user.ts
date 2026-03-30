import axios from 'axios';
import { UserProfile } from '@/types/user';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const userService = {
  async getCurrentUser(): Promise<UserProfile> {
    const response = await axios.get(`${API_URL}/auth/me`, {
      headers: getAuthHeaders(),
    });
    return response.data as UserProfile;
  },
};
