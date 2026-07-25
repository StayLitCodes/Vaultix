import axios from 'axios';
import { Notification } from '@/types/notification';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export interface NotificationPreference {
  id: string;
  userId: string;
  channel: 'email' | 'webhook';
  enabled: boolean;
  eventTypes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePreferenceDto {
  channel: 'email' | 'webhook';
  enabled: boolean;
  eventTypes: string[];
}

export const notificationService = {
  async getNotifications(): Promise<Notification[]> {
    const response = await axios.get(`${API_URL}/notifications`, {
      headers: getAuthHeaders(),
    });
    return response.data;
  },

  async getUnreadCount(): Promise<number> {
    const response = await axios.get(`${API_URL}/notifications/unread-count`, {
      headers: getAuthHeaders(),
    });
    return response.data;
  },

  async markAsRead(notificationId?: string): Promise<void> {
    await axios.post(
      `${API_URL}/notifications/mark-as-read`,
      { notificationId },
      {
        headers: getAuthHeaders(),
      },
    );
  },

  async getPreferences(): Promise<NotificationPreference[]> {
    const response = await axios.get(`${API_URL}/notifications/preferences`, {
      headers: getAuthHeaders(),
    });
    return response.data;
  },

  async updatePreferences(prefs: UpdatePreferenceDto[]): Promise<NotificationPreference[]> {
    const response = await axios.put(
      `${API_URL}/notifications/preferences`,
      prefs,
      {
        headers: getAuthHeaders(),
      },
    );
    return response.data;
  },
};
