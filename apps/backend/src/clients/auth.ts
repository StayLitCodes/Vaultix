import api from './client';
import { setTokens } from '../utils/token';

export const login = async (email: string, password: string) => {
  const response = await api.post('/auth/login', { email, password });

  const { accessToken, refreshToken } = response.data;

  setTokens(accessToken, refreshToken);

  return response.data;
};

export const register = async (data: any) => {
  return api.post('/auth/register', data);
};

export const logout = async () => {
  await api.post('/auth/logout');
};