import { useCallback, useEffect, useState } from 'react';
import { notificationApi } from '../services/api';
import { Notification } from '../types/notification';

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  reload: () => Promise<void>;
}

export const useNotifications = (): UseNotificationsReturn => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setError(null);
      const res = await notificationApi.list();
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch {
      setError('Failed to load notifications.');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchNotifications().finally(() => setLoading(false));
  }, [fetchNotifications]);

  const reload = useCallback(async () => {
    await fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = useCallback(
    async (id: string) => {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    },
    [],
  );

  const markAllAsRead = useCallback(async () => {
    await notificationApi.markAsRead();
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
    );
    setUnreadCount(0);
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    reload,
  };
};
