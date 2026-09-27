import api from './client';
import { setTokens } from '../utils/token';

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  // Optional profile payload returned alongside tokens; shape is
  // intentionally loose since the caller may not need it every time.
  user?: Record<string, unknown>;
}

interface RegisterData {
  email: string;
  password: string;
  // Optional display name; backend can presumably default this if omitted.
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
  // Persist tokens (e.g. to storage/cookies) immediately on successful
  // login so subsequent requests are authenticated.
  setTokens(accessToken, refreshToken);

  return response.data;
};

export const register = async (data: RegisterData): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>('/auth/register', data);
  // Note: unlike login, tokens returned here are NOT stored via setTokens.
  // If registration is expected to also log the user in, this may need
  // the same setTokens call as login (currently the caller must log in
  // separately, or handle token storage themselves).
  return response.data;
};

export const logout = async (): Promise<void> => {
  await api.post('/auth/logout');
  // Note: this does not clear locally stored tokens (no counterpart to
  // setTokens is called here), so the client may still hold stale
  // credentials after logout unless that's handled elsewhere.
};