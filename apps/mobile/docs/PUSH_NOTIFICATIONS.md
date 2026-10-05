# Push Notifications (#761)

The app has always had an **in-app** notification list (`app/(tabs)/notifications.tsx`, backed by
`GET /api/notifications`). Until now that was the only delivery channel: `expo-notifications` was not
even a dependency, so users only learned about escrow funding, releases and disputes by opening the
app.

This document describes the push channel that was added alongside it. If you are here because a push
arrived and the in-app list looks empty, look at [Troubleshooting](#troubleshooting) first.

## How it fits together

```
services/pushNotifications.ts   the whole lifecycle (no React)
  ├── configurePushNotifications()   foreground handler + tap listener + Android channel
  ├── requestPushPermission()        the OS prompt — only ever from Settings
  ├── registerPushToken()            resolve the Expo token -> POST /api/notifications/devices
  └── unregisterPushToken()          DELETE /api/notifications/devices/:token

hooks/usePushNotifications.ts    React binding + the Settings toggle
app/_layout.tsx                  installs the tap handler and routes the deep link
app/(tabs)/settings.tsx          the user-facing "Push Notifications" switch
services/auth.ts                 registerLogoutSideEffect() -> every logout de-registers
```

## Permission is opt-in, never automatic

The OS prompt is shown **only** when the user flips the "Push Notifications" switch in Settings. This
is not just politeness — iOS treats a permission request shown at cold start as a guaranteed
rejection, and Android 13+ does the same.

`configurePushNotifications()` is called from the root layout on every launch, but it deliberately
**never** prompts. It only:

- installs the foreground handler,
- creates the `escrow-activity` Android channel,
- subscribes to taps.

## Foreground notifications go through the Toast provider

A notification that arrives while the user is already in the app must not cover the screen they are
looking at. The handler returns:

```ts
{ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }
```

so the OS stays silent and the message is surfaced by the existing `showToast()` provider instead.

## Deep links

The backend is expected to put the relevant id in the notification's `data` payload:

```json
{ "type": "MILESTONE_RELEASED", "escrowId": "..." }
```

`app/_layout.tsx` then routes:

| Payload | Destination |
|---|---|
| `escrowId` present | `/escrow/{escrowId}` |
| no `escrowId` | `/(tabs)/notifications` |

`addNotificationResponseReceivedListener` only fires while the app is running, so
`consumeInitialNotification()` replays the tap that cold-started the app.

## Failure behaviour

Everything degrades instead of throwing:

| Situation | Result |
|---|---|
| `expo-notifications` missing / Expo Go / bare build | `isPushAvailable() === false`, toggle disabled, in-app list unaffected |
| User denies the prompt | toggle stays off, "Open system settings" is offered |
| Token cannot be resolved (no EAS `projectId`) | `getExpoPushToken()` returns `null`, registration reports `ok: false` |
| `POST /api/notifications/devices` fails | token is kept locally so the next launch retries; `ok: false` |
| Backend unreachable on logout | de-registration is best effort, local token is still cleared, sign-out is never blocked |
| A registered logout side effect throws | caught and logged; the sign-out still completes |

## Backend contract

| Endpoint | Purpose |
|---|---|
| `POST /api/notifications/devices` | `{ pushToken, platform: 'ios' \| 'android' }` — register this device for the signed-in wallet |
| `DELETE /api/notifications/devices/:pushToken` | de-register on logout / disconnect |

## Build setup

`expo-notifications` is a dependency and the plugin is configured in `app.json`:

- iOS: `UIBackgroundModes: ["remote-notification"]` so silent/background delivery works.
- Android: the plugin's `defaultChannel` matches the `escrow-activity` channel created in code.
- `extra.eas.projectId` must be present in the EAS build config, otherwise
  `getExpoPushTokenAsync()` cannot resolve a token.

Physical APNs/FCM credentials still come from the usual Expo/EAS credential flow
(`eas credentials`); nothing in this document replaces that.

## Troubleshooting

| Symptom | Check |
|---|---|
| Toggle is greyed out | `isPushAvailable()` is false — the module is not installed or this is Expo Go |
| Toggle flips on then straight back off | permission was denied, or no EAS `projectId` in this build |
| Nothing arrives on a real device | APNs/FCM credentials, and that the device token was actually accepted by the backend |
| Toast appears but tapping does nothing | the payload has no `escrowId`; it should land on the notification list instead |
| A push arrived but the in-app list is empty | the backend recorded delivery but never wrote the in-app notification row |
