# Mobile Notifications Strategy

This document outlines our notification strategy for the Vaultix mobile application.

## MVP Implementation
The current MVP implements an in-app notification center via the `NotificationsScreen`.
It polls or fetches notification items (such as Escrow Created, Dispute Opened) on load and supports mark-as-read functionality with badge counting.

## Push Notification Strategy

### Option A: Expo Push Notifications (Recommended for MVP+)
We can leverage `expo-notifications` for a quick go-to-market. 
- **Pros:** Easy integration with Expo, unifies APNs (iOS) and FCM (Android).
- **Cons:** Relies on Expo's backend.

**Implementation Notes:**
1. Install `expo-notifications` and `expo-device`.
2. Request permission on app startup.
3. Retrieve the `ExpoPushToken` and send it to our backend.
4. The backend uses the Expo Push API to dispatch notifications securely.

### Option B: Post-MVP Architecture (FCM / APNs Direct)
For stricter control over data privacy and lower latency:
- Integrate Firebase Cloud Messaging (FCM) for Android and Apple Push Notification service (APNs) for iOS natively.
- **Pros:** Full control, removes middleman, higher rate limits.
- **Cons:** Requires native code configuration (`react-native-firebase`), stepping outside the standard managed Expo workflow unless using config plugins.
