const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, '') ||
  'http://localhost:3000';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    window.localStorage.getItem('vaultix_access_token') ||
    window.localStorage.getItem('accessToken')
  );
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const errorBody = (await response
      .json()
      .catch(() => ({ message: 'Request failed' }))) as {
      message?: string | string[];
    };
    const message = Array.isArray(errorBody.message)
      ? errorBody.message.join(', ')
      : errorBody.message || 'Request failed';
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}

export function explorerTxUrl(txHash: string, network: 'testnet' | 'public') {
  const networkPath = network === 'public' ? 'public' : 'testnet';
  return `https://stellar.expert/explorer/${networkPath}/tx/${txHash}`;
}
