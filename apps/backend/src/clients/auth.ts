import api from './client';
import { setTokens } from '../utils/token';

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user?: Record<string, unknown>;
}

interface RegisterData {
  email: string;
  password: string;
  name?: string;
}

export const login = async (
  email: string,
  password: string,
): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/auth/login', {
    email,
    password,
  });

  const { accessToken, refreshToken } = response.data;
  setTokens(accessToken, refreshToken);

  return response.data;
};

export const register = async (data: RegisterData): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/auth/register', data);
  return response.data;
};

export const logout = async (): Promise<void> => {
  await api.post('/auth/logout');
};
