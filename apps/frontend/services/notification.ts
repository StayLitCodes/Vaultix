import axios from "axios";
import { Notification } from "@/types/notification";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const API_VERSION_PREFIX = "/v1";

const getAuthHeaders = () => {
  const token = localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export interface NotificationPreference {
  id: string;
  userId: string;
  channel: "email" | "webhook";
  enabled: boolean;
  eventTypes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePreferenceDto {
  channel: "email" | "webhook";
  enabled: boolean;
  eventTypes: string[];
}

export const notificationService = {
  async getNotifications(): Promise<Notification[]> {
    const response = await axios.get(
      `${API_URL}${API_VERSION_PREFIX}/notifications`,
      {
        headers: getAuthHeaders(),
      },
    );
    return response.data;
  },

  async getUnreadCount(): Promise<number> {
    const response = await axios.get(
      `${API_URL}${API_VERSION_PREFIX}/notifications/unread-count`,
      {
        headers: getAuthHeaders(),
      },
    );
    return response.data;
  },

  async markAsRead(notificationId?: string): Promise<void> {
    await axios.post(
      `${API_URL}${API_VERSION_PREFIX}/notifications/mark-as-read`,
      { notificationId },
      {
        headers: getAuthHeaders(),
      },
    );
  },

  async getPreferences(): Promise<NotificationPreference[]> {
    const response = await axios.get(
      `${API_URL}${API_VERSION_PREFIX}/notifications/preferences`,
      {
        headers: getAuthHeaders(),
      },
    );
    return response.data;
  },

  async updatePreferences(
    prefs: UpdatePreferenceDto[],
  ): Promise<NotificationPreference[]> {
    const response = await axios.patch(
      `${API_URL}${API_VERSION_PREFIX}/notifications/preferences`,
      prefs,
      {
        headers: getAuthHeaders(),
      },
    );
    return response.data;
  },
};
