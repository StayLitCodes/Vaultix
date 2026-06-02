import axios from 'axios';
import { Notification } from '@/types/notification';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

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
};
