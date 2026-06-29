import { useState, useEffect, useCallback } from 'react';
import { notificationService } from '@/services/notification';
import { Notification } from '@/types/notification';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: Error | null;
  markAsRead: (notificationId?: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refetch: () => Promise<void>;
}

const playNotificationSound = () => {
  try {
    const isSoundEnabled = localStorage.getItem('vaultix_sound_enabled') !== 'false';
    if (!isSoundEnabled) return;
    
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (error) {
    console.error('Audio play error:', error);
  }
};

export const useNotifications = (): UseNotificationsReturn => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const [notificationsData, unreadCountData] = await Promise.all([
        notificationService.getNotifications(),
        notificationService.getUnreadCount(),
      ]);
      
      // Merge with localStorage dismissed items if needed
      const dismissed: string[] = JSON.parse(localStorage.getItem('vaultix_dismissed_notifications') || '[]');
      const filtered = notificationsData.filter(n => !dismissed.includes(n.id));
      
      setNotifications(filtered);
      setUnreadCount(unreadCountData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch notifications'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markAsRead = async (notificationId?: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      if (notificationId) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } else {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
        );
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // ── WebSocket Integration ──
    const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';
    const WS_URL = `${WS_BASE_URL.replace(/\/$/, '')}/escrow`;
    const token = localStorage.getItem('vaultix_token') || localStorage.getItem('authToken');

    const socket = io(WS_URL, {
      transports: ['websocket'],
      auth: { token },
      autoConnect: true,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('Notifications WebSocket connected');
    });

    socket.on('notification:new', (data: any) => {
      console.log('Real-time notification received via WebSocket:', data);
      playNotificationSound();
      
      // Parse database-like structure
      const newNotification: Notification = {
        id: data.id || `notif-${Date.now()}`,
        userId: data.userId || '',
        eventType: data.eventType || 'NOTIFICATION',
        payload: data.payload || {},
        status: data.status || 'sent',
        retryCount: typeof data.retryCount === 'number' ? data.retryCount : 0,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || data.createdAt || new Date().toISOString(),
        readAt: data.readAt || null,
        escrowId: data.escrowId || undefined,
      };

      setNotifications((prev) => [newNotification, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // Short description trigger
      const messages: Record<string, string> = {
        ESCROW_CREATED: 'New escrow created',
        ESCROW_FUNDED: 'Escrow has been funded',
        MILESTONE_RELEASED: 'Milestone released',
        ESCROW_COMPLETED: 'Escrow completed successfully',
        ESCROW_CANCELLED: 'Escrow cancelled',
        DISPUTE_RAISED: 'Dispute raised',
        DISPUTE_RESOLVED: 'Dispute resolved',
        ESCROW_EXPIRED: 'Escrow expired',
        CONDITION_FULFILLED: 'Condition fulfilled',
        EXPIRATION_WARNING: 'Escrow expiring soon',
      };
      
      const msg = messages[newNotification.eventType] || 'New platform update received';
      toast.success(msg, {
        description: newNotification.escrowId ? `Escrow ID: ${newNotification.escrowId.slice(0, 8)}...` : undefined,
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
};
