export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

export interface UserProfile {
  id: string;
  walletAddress: string;
  isActive: boolean;
  role?: UserRole;
  createdAt: string;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  key?: string;
  active: boolean;
  rateLimitPerMinute: number;
  createdAt: string;
}
