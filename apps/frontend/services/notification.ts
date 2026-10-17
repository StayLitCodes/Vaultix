import { Notification } from "@/types/notification";
import { apiClient } from "@/lib/api-client";

export interface NotificationPreference {
  id: string;
  userId: string;
  channel: "email" | "webhook";
  enabled: boolean;
  eventTypes: string[];
  soundEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePreferenceDto {
  channel: "email" | "webhook";
  enabled: boolean;
  eventTypes: string[];
  soundEnabled?: boolean;
}

export const notificationService = {
  async getNotifications(): Promise<Notification[]> {
    return apiClient.get<Notification[]>("/notifications");
  },

  async getUnreadCount(): Promise<number> {
    return apiClient.get<number>("/notifications/unread-count");
  },

  async markAsRead(notificationId?: string): Promise<void> {
    await apiClient.post("/notifications/mark-as-read", { notificationId });
  },

  async getPreferences(): Promise<NotificationPreference[]> {
    return apiClient.get<NotificationPreference[]>("/notifications/preferences");
  },

  async updatePreferences(
    prefs: UpdatePreferenceDto[],
  ): Promise<NotificationPreference[]> {
    return apiClient.patch<NotificationPreference[]>(
      "/notifications/preferences",
      prefs,
    );
  },
};
