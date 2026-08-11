import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationService, NotificationPreference, UpdatePreferenceDto } from '@/services/notification';
import { Notification } from '@/types/notification';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────────

/** Per-event channel toggles used by the UI */
export interface UserPreferences {
  [eventType: string]: {
    email: boolean;
    inApp: boolean;
  };
}

/** All known notification event types (mirrors backend NotificationEventType enum) */
export const ALL_EVENT_TYPES = [
  'PARTY_INVITED',
  'PARTY_ACCEPTED',
  'PARTY_REJECTED',
  'ESCROW_CREATED',
  'ESCROW_FUNDED',
  'MILESTONE_RELEASED',
  'ESCROW_COMPLETED',
  'ESCROW_CANCELLED',
  'DISPUTE_RAISED',
  'DISPUTE_RESOLVED',
  'ESCROW_EXPIRED',
  'CONDITION_FULFILLED',
  'CONDITION_CONFIRMED',
  'EXPIRATION_WARNING',
] as const;

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: Error | null;
  markAsRead: (notificationId?: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refetch: () => Promise<void>;
  /** Current user notification preferences keyed by event type */
  preferences: UserPreferences;
  /** True while preferences are being fetched from the backend */
  preferencesLoading: boolean;
  /** True while preferences are being saved to the backend */
  savingPreferences: boolean;
  /** Persist preference changes to the backend. Returns true on success, false on failure. */
  updatePreferences: (prefs: UserPreferences) => Promise<boolean>;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Transform backend preference array into UI-friendly UserPreferences map */
function backendToUserPreferences(backendPrefs: NotificationPreference[]): UserPreferences {
  const result: UserPreferences = {};

  // Initialize all known event types with defaults
  for (const eventType of ALL_EVENT_TYPES) {
    result[eventType] = { email: false, inApp: false };
  }

  // Apply backend preferences on top
  for (const pref of backendPrefs) {
    const channel = pref.channel === 'email' ? 'email' : 'inApp';
    for (const eventType of pref.eventTypes) {
      if (result[eventType]) {
        result[eventType][channel] = pref.enabled;
      }
    }
  }

  return result;
}

/** Transform UI-friendly UserPreferences map into backend UpdatePreferenceDto array */
function userPreferencesToBackend(prefs: UserPreferences): UpdatePreferenceDto[] {
  const emailEventTypes: string[] = [];
  const inAppEventTypes: string[] = [];

  for (const [eventType, channels] of Object.entries(prefs)) {
    if (channels.email) emailEventTypes.push(eventType);
    if (channels.inApp) inAppEventTypes.push(eventType);
  }

  return [
    { channel: 'email', enabled: emailEventTypes.length > 0, eventTypes: emailEventTypes },
    { channel: 'webhook', enabled: inAppEventTypes.length > 0, eventTypes: inAppEventTypes },
  ];
}

/** Default preferences when backend is unavailable */
function getDefaultPreferences(): UserPreferences {
  const result: UserPreferences = {};
  for (const eventType of ALL_EVENT_TYPES) {
    result[eventType] = { email: true, inApp: true };
  }
  return result;
}

// ── Sound ──────────────────────────────────────────────────────────────────

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

// ── Hook ───────────────────────────────────────────────────────────────────

export const useNotifications = (): UseNotificationsReturn => {
  // Notification state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Preference state
  const [preferences, setPreferences] = useState<UserPreferences>(getDefaultPreferences());
  const [preferencesLoading, setPreferencesLoading] = useState<boolean>(true);
  const [savingPreferences, setSavingPreferences] = useState<boolean>(false);

  // Track whether initial fetch has happened to avoid double-fetch in StrictMode
  const initialFetchDone = useRef(false);

  // Debounce state for API calls
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPrefsRef = useRef<UserPreferences | null>(null);

  // ── Fetch notifications ────────────────────────────────────────────────

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

  // ── Fetch preferences from backend ─────────────────────────────────────

  const fetchPreferences = useCallback(async () => {
    try {
      setPreferencesLoading(true);
      const backendPrefs = await notificationService.getPreferences();
      if (backendPrefs && backendPrefs.length > 0) {
        setPreferences(backendToUserPreferences(backendPrefs));
      }
    } catch (err) {
      // Offline / error — keep defaults, don't show toast on initial load
      console.error('Failed to fetch notification preferences:', err);
    } finally {
      setPreferencesLoading(false);
    }
  }, []);

  // ── Persist preferences to backend ─────────────────────────────────────

  const updatePreferences = useCallback(
    (prefs: UserPreferences): Promise<boolean> => {
      // Optimistically update local state immediately — no delay
      setPreferences(prefs);
      pendingPrefsRef.current = prefs;

      return new Promise<boolean>((resolve) => {
        // Clear any pending debounced save
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

        // Debounce the API call: wait 400ms after last toggle before saving
        debounceTimerRef.current = setTimeout(async () => {
          const toSave = pendingPrefsRef.current;
          if (!toSave) {
            resolve(false);
            return;
          }

          try {
            setSavingPreferences(true);
            const dto = userPreferencesToBackend(toSave);
            await notificationService.updatePreferences(dto);
            toast.success('Notification preferences saved');
            resolve(true);
          } catch (err) {
            // Revert to previous state on failure by re-fetching
            toast.error('Failed to save preferences. Please try again.');
            console.error('Failed to update notification preferences:', err);
            try {
              const backendPrefs = await notificationService.getPreferences();
              if (backendPrefs && backendPrefs.length > 0) {
                setPreferences(backendToUserPreferences(backendPrefs));
              }
            } catch {
              // If even re-fetch fails, keep the optimistic update
            }
            resolve(false);
          } finally {
            setSavingPreferences(false);
            pendingPrefsRef.current = null;
          }
        }, 400);
      });
    },
    [],
  );

  // ── Mark as read ───────────────────────────────────────────────────────

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

  // ── Initial load ───────────────────────────────────────────────────────

  useEffect(() => {
    if (initialFetchDone.current) return;
    initialFetchDone.current = true;

    fetchNotifications();
    fetchPreferences();

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
  }, [fetchNotifications, fetchPreferences]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
    preferences,
    preferencesLoading,
    savingPreferences,
    updatePreferences,
  };
};
