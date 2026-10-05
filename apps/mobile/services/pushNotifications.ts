/**
 * #761 — Push notification delivery.
 *
 * The app shipped with an in-app notification *list* but no push delivery at
 * all: `expo-notifications` was not a dependency and there were zero
 * `Notifications.*` calls, so users only learned about escrow funding, releases
 * and disputes by opening the app.
 *
 * This module owns the whole lifecycle:
 *
 * 1. `configurePushNotifications()` — installs the foreground handler (surfaces
 *    through the existing `Toast` provider instead of an OS banner), creates the
 *    Android channel and wires the tap → deep-link listener.
 * 2. `requestPushPermission()` — asks the OS. **Never** called on cold start:
 *    permission is only requested from an explicit user action (the Settings
 *    toggle), which is what iOS requires anyway.
 * 3. `registerPushToken()` / `unregisterPushToken()` — keep the backend's device
 *    list in sync with the signed-in wallet. `services/auth.ts` calls the
 *    de-registration on every logout so a shared device does not keep pushing
 *    the previous wallet's escrows.
 *
 * Everything degrades gracefully: if the module is missing (Expo Go, a test
 * runner, a bare install) or the OS denies permission, every function resolves
 * to a "no" result instead of throwing.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

import { notificationApi } from './api';
import { getSecureItem, saveSecureItem, deleteSecureItem } from '../utils/secureStore';
import { showToast } from '../components/Toast';
import type { DeviceRegistration, PushPermissionStatus, PushPlatform } from '../types/notification';

const ENABLED_KEY = 'push_notifications_enabled';
const TOKEN_KEY = 'push_notifications_token';

/** Payload the backend sends in `data` so a tap can deep-link. */
export interface PushPayload {
  escrowId?: string;
  type?: string;
  [key: string]: unknown;
}

type NotificationResponse = {
  notification?: { request?: { content?: { data?: PushPayload } } };
};

let handlersInstalled = false;
let responseSubscription: Notifications.EventSubscription | null = null;
let receivedSubscription: Notifications.EventSubscription | null = null;
let tapHandler: ((payload: PushPayload) => void) | null = null;

/** Test-only: forget installed handlers/subscriptions. */
export function __resetPushStateForTests(): void {
  handlersInstalled = false;
  responseSubscription = null;
  receivedSubscription = null;
  tapHandler = null;
}

/**
 * Pull the `{ escrowId }` payload out of whatever shape the OS handed us.
 * Expo puts custom data under `notification.request.content.data`, but a
 * notification received while the app was killed can arrive as a bare object.
 */
export function extractPushPayload(input: unknown): PushPayload {
  if (!input || typeof input !== 'object') return {};

  const direct = input as NotificationResponse;
  const data = direct.notification?.request?.content?.data ?? (input as PushPayload);
  return (data ?? {}) as PushPayload;
}

/** True when this OS build can actually deliver push. */
export function isPushAvailable(): boolean {
  return Boolean(Notifications) && typeof Notifications.getExpoPushTokenAsync === 'function';
}

/**
 * #791 — the in-app line shown for a push that arrives while the app is already
 * open. The foreground handler suppresses the OS banner on purpose, so without
 * this the notification produced no user-facing feedback at all.
 */
export function foregroundPushMessage(notification: unknown): string {
  const content = (notification as {
    request?: { content?: { title?: string; body?: string } };
  } | null)?.request?.content;

  const title = content?.title?.trim();
  const body = content?.body?.trim();
  if (title && body) return `${title} — ${body}`;
  return title || body || 'New escrow activity';
}

function currentPlatform(): PushPlatform {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

/**
 * Install the foreground handler and the tap listener.
 *
 * Idempotent, and safe to call before a session exists. Deliberately does
 * **not** request permission — see `requestPushPermission`.
 */
export function configurePushNotifications(options?: {
  /** Called when the user taps a notification, e.g. to route to the escrow. */
  onNotificationTap?: (payload: PushPayload) => void;
}): void {
  if (!isPushAvailable()) return;

  if (options?.onNotificationTap) {
    tapHandler = options.onNotificationTap;
  }

  if (handlersInstalled) return;
  handlersInstalled = true;

  // Foreground: surface through the in-app Toast provider rather than an OS
  // banner, which would cover the app the user is already looking at (#761).
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  // Android needs an explicit channel or nothing is delivered.
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync('escrow-activity', {
      name: 'Escrow activity',
      importance: Notifications.AndroidImportance?.HIGH ?? 4,
      vibrationPattern: [0, 250, 250, 250],
    }).catch(() => {
      /* channel creation is best-effort */
    });
  }

  responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const payload = extractPushPayload(response);
      tapHandler?.(payload);
    },
  );

  // #791 — `addNotificationResponseReceivedListener` only fires for taps while
  // the app is running, and the handler above suppresses the OS banner, so a push
  // received in the foreground used to be dropped silently. Surface it in-app.
  receivedSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      try {
        showToast({ message: foregroundPushMessage(notification), type: 'info' });
      } catch {
        // The Toast provider is not mounted yet on a very early cold start.
      }
    },
  );
}

/** Stop listening for taps (used on unmount and in tests). */
export function teardownPushNotifications(): void {
  responseSubscription?.remove();
  responseSubscription = null;
  receivedSubscription?.remove();
  receivedSubscription = null;
  tapHandler = null;
  handlersInstalled = false;
}

/**
 * The notification that cold-started the app, consumed once.
 *
 * `addNotificationResponseReceivedListener` only fires for taps that happen
 * while the app is already running, so without this a user who taps a
 * notification from a cold start would land on the default screen.
 */
export async function consumeInitialNotification(): Promise<PushPayload | null> {
  if (!isPushAvailable() || typeof Notifications.getLastNotificationResponseAsync !== 'function') {
    return null;
  }
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (!response) return null;
    const payload = extractPushPayload(response);
    return Object.keys(payload).length > 0 ? payload : null;
  } catch {
    return null;
  }
}

/** Current OS permission state, without prompting. */
export async function getPushPermissionStatus(): Promise<PushPermissionStatus> {
  if (!isPushAvailable()) return 'unavailable';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'undetermined';
  } catch {
    return 'unavailable';
  }
}

/**
 * Ask the OS for permission. Only ever call this from a deliberate user
 * action — iOS rejects the prompt shown at cold start.
 */
export async function requestPushPermission(): Promise<PushPermissionStatus> {
  if (!isPushAvailable()) return 'unavailable';
  try {
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;

    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }

    if (status === 'granted') return 'granted';
    return status === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'unavailable';
  }
}

/** Fetch the Expo push token, or `null` when push is unavailable/denied. */
export async function getExpoPushToken(): Promise<string | null> {
  if (!isPushAvailable()) return null;
  if ((await getPushPermissionStatus()) !== 'granted') return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;

  try {
    const { data } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return data ?? null;
  } catch (error) {
    // No projectId in a bare/dev build is the common case here.
    console.warn('Could not resolve an Expo push token:', error);
    return null;
  }
}

/** Persist a token so logout can de-register exactly the same device. */
async function rememberToken(token: string | null): Promise<void> {
  if (token) {
    await saveSecureItem(TOKEN_KEY, token);
  } else {
    await deleteSecureItem(TOKEN_KEY);
  }
}

export async function getStoredPushToken(): Promise<string | null> {
  return getSecureItem(TOKEN_KEY);
}

/**
 * Request permission (if needed), resolve the token and register it with the
 * backend. Returns the outcome so Settings can show an accurate message.
 */
export async function registerPushToken(): Promise<{
  ok: boolean;
  token: string | null;
  status: PushPermissionStatus;
}> {
  if (!isPushAvailable()) {
    return { ok: false, token: null, status: 'unavailable' };
  }

  const status = await requestPushPermission();
  if (status !== 'granted') {
    return { ok: false, token: null, status };
  }

  const token = await getExpoPushToken();
  if (!token) {
    return { ok: false, token: null, status };
  }

  const device: DeviceRegistration = { pushToken: token, platform: currentPlatform() };
  try {
    await notificationApi.registerDevice(device);
  } catch (error) {
    // Keep the token locally: the next app launch can retry the registration.
    await rememberToken(token);
    console.warn('Push token registration failed:', error);
    return { ok: false, token, status };
  }

  await rememberToken(token);
  return { ok: true, token, status };
}

/** De-register the stored token from the backend. Never throws. */
export async function unregisterPushToken(): Promise<void> {
  const token = await getStoredPushToken();
  if (!token) return;
  try {
    await notificationApi.unregisterDevice(token);
  } catch (error) {
    // Best effort: a token that is already gone server-side is fine.
    console.warn('Push token de-registration failed:', error);
  } finally {
    await rememberToken(null);
  }
}

/** The user-facing toggle state. Defaults to off until they opt in. */
export async function isPushEnabledPreference(): Promise<boolean> {
  return (await getSecureItem(ENABLED_KEY)) === 'true';
}

export async function setPushEnabledPreference(enabled: boolean): Promise<void> {
  await saveSecureItem(ENABLED_KEY, enabled ? 'true' : 'false');
  if (!enabled) {
    await unregisterPushToken();
  }
}

/**
 * Called on sign-in: re-register the device for the newly connected wallet when
 * the user has already opted in. Silent when they have not.
 */
export async function syncPushRegistrationOnSignIn(): Promise<void> {
  if (!(await isPushEnabledPreference())) return;
  await registerPushToken();
}
