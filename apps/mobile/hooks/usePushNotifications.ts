/**
 * #761 — React binding over the push notification service.
 *
 * Owns the user-facing toggle in Settings: requesting permission only in
 * response to that explicit action (never on cold start), and reporting a
 * denial honestly so the UI can offer "Open Settings" instead of silently
 * doing nothing.
 */
import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';

import {
  configurePushNotifications,
  consumeInitialNotification,
  getPushPermissionStatus,
  isPushAvailable,
  isPushEnabledPreference,
  registerPushToken,
  setPushEnabledPreference,
  teardownPushNotifications,
  type PushPayload,
} from '../services/pushNotifications';
import { showToast } from '../components/Toast';
import type { PushPermissionStatus } from '../types/notification';

export interface UsePushNotificationsReturn {
  /** The user's toggle state. */
  isEnabled: boolean;
  /** Whether this build/OS can deliver push at all. */
  isSupported: boolean;
  /** Live OS permission state, refreshed after every toggle. */
  permissionStatus: PushPermissionStatus;
  /** True while a permission prompt / registration is in flight. */
  isBusy: boolean;
  /** Flip the toggle. Resolves to the state the user actually ended up in. */
  setEnabled: (enabled: boolean) => Promise<{ enabled: boolean; status: PushPermissionStatus }>;
  /** Deep-link the user to the OS settings page after a hard denial. */
  openSystemSettings: () => Promise<void>;
}

export function usePushNotifications(
  onNotificationTap?: (payload: PushPayload) => void,
): UsePushNotificationsReturn {
  const [isEnabled, setIsEnabled] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PushPermissionStatus>('undetermined');
  const [isBusy, setIsBusy] = useState(false);
  const isSupported = isPushAvailable();

  useEffect(() => {
    let cancelled = false;

    configurePushNotifications({ onNotificationTap });

    // A tap that cold-started the app never reaches the response listener.
    void consumeInitialNotification().then((payload) => {
      if (!cancelled && payload) onNotificationTap?.(payload);
    });

    void (async () => {
      const [enabled, status] = await Promise.all([
        isPushEnabledPreference(),
        getPushPermissionStatus(),
      ]);
      if (cancelled) return;
      setIsEnabled(enabled);
      setPermissionStatus(status);
    })();

    return () => {
      cancelled = true;
      teardownPushNotifications();
    };
    // `onNotificationTap` is re-read on every render by the service, so the
    // effect only needs to run once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setEnabled = useCallback(async (enabled: boolean) => {
    setIsBusy(true);
    try {
      if (!enabled) {
        await setPushEnabledPreference(false);
        setIsEnabled(false);
        const status = await getPushPermissionStatus();
        setPermissionStatus(status);
        showToast({ message: 'Push notifications turned off', type: 'info' });
        return { enabled: false, status };
      }

      if (!isPushAvailable()) {
        showToast({ message: 'Push notifications are not available on this build', type: 'error' });
        return { enabled: false, status: 'unavailable' as PushPermissionStatus };
      }

      const result = await registerPushToken();

      if (result.ok) {
        await setPushEnabledPreference(true);
        setIsEnabled(true);
        setPermissionStatus('granted');
        showToast({ message: 'Push notifications enabled', type: 'success' });
        return { enabled: true, status: 'granted' as PushPermissionStatus };
      }

      // Graceful denial path: leave the toggle off and tell the user why.
      setIsEnabled(false);
      setPermissionStatus(result.status);
      if (result.status === 'denied') {
        showToast({ message: 'Notifications are blocked — enable them in system settings', type: 'error' });
      } else {
        showToast({ message: 'Could not enable notifications', type: 'error' });
      }
      return { enabled: false, status: result.status };
    } finally {
      setIsBusy(false);
    }
  }, []);

  const openSystemSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      showToast({ message: 'Could not open system settings', type: 'error' });
    }
  }, []);

  return {
    isEnabled,
    isSupported,
    permissionStatus,
    isBusy,
    setEnabled,
    openSystemSettings,
  };
}
