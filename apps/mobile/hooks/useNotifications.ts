import { useState, useEffect } from 'react';
import { NotificationService, NotificationItem } from '../services/NotificationService';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    const data = await NotificationService.fetchNotifications();
    setNotifications(data);
    updateUnreadCount(data);
  };

  const updateUnreadCount = (items: NotificationItem[]) => {
    setUnreadCount(items.filter(n => !n.isRead).length);
  };

  const markAsRead = async (id: string) => {
    const success = await NotificationService.markAsRead(id);
    if (success) {
      const updated = notifications.map(n =>
        n.id === id ? { ...n, isRead: true } : n
      );
      setNotifications(updated);
      updateUnreadCount(updated);
    }
  };

  const markAllAsRead = async () => {
    const success = await NotificationService.markAllAsRead();
    if (success) {
      const updated = notifications.map(n => ({ ...n, isRead: true }));
      setNotifications(updated);
      setUnreadCount(0);
    }
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    reload: loadNotifications,
  };
};
