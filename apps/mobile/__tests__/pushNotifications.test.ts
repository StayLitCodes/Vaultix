/**
 * #761 — push notification delivery.
 *
 * The app shipped with an in-app notification list but no push at all:
 * `expo-notifications` was not a dependency and there were zero
 * `Notifications.*` calls, so users only learned about funding, releases and
 * disputes by opening the app.
 */
import { waitFor } from '@testing-library/react-native';

const mockStore = new Map<string, string>();
const mockAsyncStore = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async (key: string, value: string) => {
    mockAsyncStore.set(key, value);
  }),
  getItem: jest.fn(async (key: string) => mockAsyncStore.get(key) ?? null),
  getAllKeys: jest.fn(async () => Array.from(mockAsyncStore.keys())),
  multiRemove: jest.fn(async (keys: string[]) => {
    keys.forEach((key) => mockAsyncStore.delete(key));
  }),
  removeItem: jest.fn(async (key: string) => {
    mockAsyncStore.delete(key);
  }),
}));

jest.mock('../utils/secureStore', () => ({
  saveSecureItem: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value);
  }),
  getSecureItem: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  deleteSecureItem: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

jest.mock('../services/api', () => ({
  notificationApi: {
    registerDevice: jest.fn(),
    unregisterDevice: jest.fn(),
  },
}));

jest.mock('../components/Toast', () => ({
  showToast: jest.fn(),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'project-123' } } } },
}));

const mockNotifications = {
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  addNotificationReceivedListener: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(),
  AndroidImportance: { HIGH: 4 },
};

jest.mock('expo-notifications', () => mockNotifications);

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  __resetPushStateForTests,
  configurePushNotifications,
  consumeInitialNotification,
  extractPushPayload,
  getExpoPushToken,
  getPushPermissionStatus,
  isPushEnabledPreference,
  isPushAvailable,
  registerPushToken,
  requestPushPermission,
  setPushEnabledPreference,
  syncPushRegistrationOnSignIn,
  teardownPushNotifications,
  unregisterPushToken,
} from '../services/pushNotifications';
import { notificationApi } from '../services/api';
import { getSecureItem } from '../utils/secureStore';
import { logout, registerLogoutSideEffect, signOut, __resetAuthForTests } from '../services/auth';

const mocked = Notifications as unknown as typeof mockNotifications;

/** Let fire-and-forget logout side effects settle. */
const flushAsync = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.clear();
  mockAsyncStore.clear();
  __resetAuthForTests();
  __resetPushStateForTests();
  mocked.setNotificationChannelAsync.mockResolvedValue(undefined);
  mocked.addNotificationResponseReceivedListener.mockReturnValue({ remove: jest.fn() });
  mocked.getLastNotificationResponseAsync.mockResolvedValue(null);
  mocked.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mocked.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mocked.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
});

describe('push notification configuration (#761)', () => {
  it('routes foreground notifications to the Toast provider, not an OS banner', () => {
    configurePushNotifications();

    expect(mocked.setNotificationHandler).toHaveBeenCalledTimes(1);
    const handler = mocked.setNotificationHandler.mock.calls[0][0];
    expect(typeof handler.handleNotification).toBe('function');

    return handler.handleNotification().then((result: Record<string, boolean>) => {
      expect(result).toEqual({
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      });
    });
  });

  it('creates the Android channel and never asks for permission at startup', () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });

    configurePushNotifications();

    expect(mocked.setNotificationChannelAsync).toHaveBeenCalledWith(
      'escrow-activity',
      expect.objectContaining({ name: 'Escrow activity' }),
    );
    // The whole point of #761: no cold-start permission prompt.
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();

    Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
  });

  it('is idempotent and cleans up its subscription', () => {
    const remove = jest.fn();
    mocked.addNotificationResponseReceivedListener.mockReturnValue({ remove });

    configurePushNotifications();
    configurePushNotifications();
    expect(mocked.setNotificationHandler).toHaveBeenCalledTimes(1);

    teardownPushNotifications();
    expect(remove).toHaveBeenCalledTimes(1);

    // Re-configuring after teardown works again (a remount).
    configurePushNotifications();
    expect(mocked.setNotificationHandler).toHaveBeenCalledTimes(2);
  });
});

describe('deep links from a tapped notification (#761)', () => {
  it('extracts the escrow id from the nested Expo payload', () => {
    const payload = extractPushPayload({
      notification: {
        request: {
          content: {
            data: { escrowId: 'escrow-42', type: 'MILESTONE_RELEASED' },
          },
        },
      },
    });
    expect(payload).toEqual({ escrowId: 'escrow-42', type: 'MILESTONE_RELEASED' });
  });

  it('extracts the escrow id from a bare data object', () => {
    expect(extractPushPayload({ escrowId: 'escrow-7' })).toEqual({ escrowId: 'escrow-7' });
    expect(extractPushPayload(undefined)).toEqual({});
  });

  it('forwards a tap to the registered handler', () => {
    const onTap = jest.fn();
    configurePushNotifications({ onNotificationTap: onTap });

    const listener = mocked.addNotificationResponseReceivedListener.mock.calls[0][0];
    listener({
      notification: { request: { content: { data: { escrowId: 'escrow-9' } } } },
    });

    expect(onTap).toHaveBeenCalledWith({ escrowId: 'escrow-9' });
  });

  it('replays the notification that cold-started the app', async () => {
    mocked.getLastNotificationResponseAsync.mockResolvedValue({
      notification: { request: { content: { data: { escrowId: 'escrow-from-cold-start' } } } },
    });

    await expect(consumeInitialNotification()).resolves.toEqual({
      escrowId: 'escrow-from-cold-start',
    });
  });

  it('returns null when the app was not opened by a notification', async () => {
    await expect(consumeInitialNotification()).resolves.toBeNull();
  });
});

describe('permission handling (#761)', () => {
  it('requests permission and registers the token on opt-in', async () => {
    const result = await registerPushToken();

    expect(result).toEqual({
      ok: true,
      token: 'ExponentPushToken[abc]',
      status: 'granted',
    });
    expect(notificationApi.registerDevice).toHaveBeenCalledWith({
      pushToken: 'ExponentPushToken[abc]',
      platform: 'android',
    });
    // Persisted so logout can de-register exactly this device.
    expect(getSecureItem).toHaveBeenCalledWith('push_notifications_token');
  });

  it('degrades gracefully when the user denies permission', async () => {
    mocked.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const result = await registerPushToken();

    expect(result).toEqual({ ok: false, token: null, status: 'denied' });
    expect(notificationApi.registerDevice).not.toHaveBeenCalled();
    expect(await isPushEnabledPreference()).toBe(false);
  });

  it('degrades gracefully when the module has no push support', async () => {
    const original = (Notifications as unknown as { getExpoPushTokenAsync?: unknown })
      .getExpoPushTokenAsync;
    (Notifications as unknown as { getExpoPushTokenAsync?: unknown }).getExpoPushTokenAsync =
      undefined;
    __resetPushStateForTests();

    try {
      expect(isPushAvailable()).toBe(false);
      await expect(registerPushToken()).resolves.toEqual({
        ok: false,
        token: null,
        status: 'unavailable',
      });
      await expect(getExpoPushToken()).resolves.toBeNull();
    } finally {
      (Notifications as unknown as { getExpoPushTokenAsync?: unknown })
        .getExpoPushTokenAsync = original;
    }
  });

  it('reports the current permission state without prompting', async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    await expect(getPushPermissionStatus()).resolves.toBe('undetermined');
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();

    await requestPushPermission();
    expect(mocked.requestPermissionsAsync).toHaveBeenCalled();
  });
});

describe('de-registration (#761)', () => {
  it('removes the stored token from the backend and forgets it locally', async () => {
    mockStore.set('push_notifications_token', 'ExponentPushToken[abc]');

    await unregisterPushToken();

    expect(notificationApi.unregisterDevice).toHaveBeenCalledWith('ExponentPushToken[abc]');
    expect(mockStore.has('push_notifications_token')).toBe(false);
  });

  it('is a no-op when no token was ever registered', async () => {
    await unregisterPushToken();
    expect(notificationApi.unregisterDevice).not.toHaveBeenCalled();
  });

  it('never throws when the backend is unreachable', async () => {
    mockStore.set('push_notifications_token', 'ExponentPushToken[abc]');
    (notificationApi.unregisterDevice as jest.Mock).mockRejectedValue(new Error('offline'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(unregisterPushToken()).resolves.toBeUndefined();
    // Local state is still cleaned up so we do not retry a dead token forever.
    expect(mockStore.has('push_notifications_token')).toBe(false);
    warn.mockRestore();
  });

  it('turning the toggle off de-registers the device', async () => {
    mockStore.set('push_notifications_token', 'ExponentPushToken[abc]');

    await setPushEnabledPreference(false);

    expect(await isPushEnabledPreference()).toBe(false);
    expect(notificationApi.unregisterDevice).toHaveBeenCalledWith('ExponentPushToken[abc]');
  });
});

describe('re-registration on sign-in (#761)', () => {
  it('does nothing when the user never opted in', async () => {
    await syncPushRegistrationOnSignIn();
    expect(notificationApi.registerDevice).not.toHaveBeenCalled();
  });

  it('re-registers the new wallet device after opting in', async () => {
    await setPushEnabledPreference(true);
    mocked.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[def]' });

    await syncPushRegistrationOnSignIn();

    expect(notificationApi.registerDevice).toHaveBeenCalledWith({
      pushToken: 'ExponentPushToken[def]',
      platform: 'android',
    });
  });
});

describe('logout de-registration (#761)', () => {
  it('runs on both logout paths once the root layout registers the effect', async () => {
    const TOKEN = 'ExponentPushToken[abc]';
    const unregister = registerLogoutSideEffect(() => {
      void unregisterPushToken();
    });

    // `signOut()` and `logout()` are both teardown paths; the Settings
    // "Disconnect wallet" button goes through one of them.
    mockStore.set('push_notifications_token', TOKEN);
    await signOut();
    await waitFor(() => expect(notificationApi.unregisterDevice).toHaveBeenCalledWith(TOKEN));

    mockStore.set('push_notifications_token', TOKEN);
    await logout();
    await waitFor(() => expect(notificationApi.unregisterDevice).toHaveBeenCalledTimes(2));

    unregister();
    mockStore.set('push_notifications_token', TOKEN);
    await logout();
    await flushAsync();
    // Unregistered effects no longer run.
    expect(notificationApi.unregisterDevice).toHaveBeenCalledTimes(2);
  });

  it('never lets a failing side effect block the sign-out', async () => {
    const unregister = registerLogoutSideEffect(() => {
      throw new Error('boom');
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(logout()).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalled();
    unregister();
    warn.mockRestore();
  });
});
