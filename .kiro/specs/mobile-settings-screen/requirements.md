# Requirements Document

## Introduction

The Settings screen for the Vaultix mobile app provides users with a single place to view their account/wallet information and manage their preferences. The screen expands the current minimal security settings page to include three sections: wallet account info, notification preferences, and security toggles. All preferences must survive app restarts. Because a backend notification-preferences API does not yet exist, notification preferences are stored locally on the device using SecureStore. The Settings screen must be reachable from the main tab navigation.

## Glossary

- **Settings_Screen**: The React Native screen located at `apps/mobile/app/(tabs)/settings.tsx` that hosts all user preference sections.
- **Tab_Navigator**: The Expo Router `<Tabs>` component defined in `apps/mobile/app/(tabs)/_layout.tsx` that provides bottom-tab navigation.
- **Wallet_Section**: The UI group on the Settings screen that displays the authenticated user's wallet address and provides a copy action.
- **Wallet_Address**: The Stellar blockchain address string associated with the authenticated user, stored in SecureStore under the key `wallet_address`.
- **Notification_Preferences**: The local record of the user's push-notification and in-app-notification opt-in choices, stored in SecureStore under the key `notification_preferences`.
- **Push_Notification**: A notification delivered by the device OS notification system when the app is in the background or closed.
- **In_App_Notification**: A notification displayed as an in-app banner or alert while the user is actively using the app.
- **Security_Section**: The UI group on the Settings screen that hosts the biometric lock toggle.
- **Biometric_Lock**: The feature controlled by `useBiometricLock` that requires FaceID/TouchID when opening Vaultix.
- **SecureStore**: The `expo-secure-store` wrapper at `apps/mobile/utils/secureStore.ts` exposing `saveSecureItem`, `getSecureItem`, and `deleteSecureItem`.
- **useNotificationPreferences**: A new React hook that reads and writes Notification_Preferences via SecureStore.
- **Clipboard**: The `expo-clipboard` package used to copy text to the device clipboard.

## Requirements

### Requirement 1: Settings Tab Navigation Entry Point

**User Story:** As a user, I want to access Settings from the bottom tab bar, so that I can reach my preferences from any screen in the app.

#### Acceptance Criteria

1. THE Tab_Navigator SHALL include a Settings tab that navigates to the Settings_Screen.
2. WHEN the Settings tab icon is tapped, THE Tab_Navigator SHALL make the Settings_Screen the active screen.
3. THE Tab_Navigator SHALL display the Settings tab with a recognisable settings icon and the label "Settings".

---

### Requirement 2: Wallet Address Display

**User Story:** As a user, I want to see my wallet address on the Settings screen, so that I can verify which wallet is associated with my account.

#### Acceptance Criteria

1. WHEN the Settings_Screen loads, THE Wallet_Section SHALL retrieve the Wallet_Address from SecureStore and display it.
2. IF the Wallet_Address is not found in SecureStore, THEN THE Wallet_Section SHALL display a placeholder message indicating that no wallet address is available.
3. THE Wallet_Section SHALL display the Wallet_Address in a truncated format showing the first 6 and last 4 characters separated by "…" when the full address exceeds 12 characters.

---

### Requirement 3: Wallet Address Copy

**User Story:** As a user, I want to copy my wallet address to the clipboard, so that I can paste it into other apps without transcription errors.

#### Acceptance Criteria

1. WHEN a user taps the copy button in the Wallet_Section, THE Settings_Screen SHALL write the full Wallet_Address to the device Clipboard.
2. WHEN the Wallet_Address has been successfully written to the Clipboard, THE Settings_Screen SHALL display a transient confirmation message for 2 seconds.
3. IF the Wallet_Address is not available, THEN THE Settings_Screen SHALL disable the copy button.

---

### Requirement 4: Notification Preferences Toggles

**User Story:** As a user, I want to enable or disable push and in-app notifications separately, so that I receive only the alerts that are relevant to me.

#### Acceptance Criteria

1. WHEN the Settings_Screen loads, THE useNotificationPreferences hook SHALL read Notification_Preferences from SecureStore and expose the current state of the push-notification and in-app-notification toggles.
2. WHEN a user toggles the push-notification switch, THE useNotificationPreferences hook SHALL persist the updated Push_Notification preference to SecureStore immediately.
3. WHEN a user toggles the in-app-notification switch, THE useNotificationPreferences hook SHALL persist the updated In_App_Notification preference to SecureStore immediately.
4. WHEN Notification_Preferences are not yet stored in SecureStore, THE useNotificationPreferences hook SHALL default both push-notification and in-app-notification preferences to enabled (true).

---

### Requirement 5: Notification Preferences Persistence

**User Story:** As a user, I want my notification preferences to be remembered after I close and reopen the app, so that I do not have to reconfigure them each session.

#### Acceptance Criteria

1. WHEN the app restarts, THE useNotificationPreferences hook SHALL restore the Notification_Preferences that were previously saved to SecureStore.
2. WHEN both push-notification and in-app-notification preferences are read from SecureStore, THE Settings_Screen SHALL reflect their persisted values in the toggle controls without user interaction.

---

### Requirement 6: Biometric Lock Toggle

**User Story:** As a user, I want to enable or disable biometric app lock from the Settings screen, so that I can control whether FaceID/TouchID is required to open Vaultix.

#### Acceptance Criteria

1. WHEN the Settings_Screen loads and the device supports biometrics with enrolled credentials, THE Security_Section SHALL display an enabled biometric lock toggle reflecting the current state from `useBiometricLock`.
2. WHEN the device does not support biometrics or has no enrolled credentials, THE Security_Section SHALL display the biometric lock toggle as disabled and show a descriptive message.
3. WHEN a user turns on the biometric lock toggle, THE Security_Section SHALL invoke `useBiometricLock.enableBiometric` and require a successful biometric authentication before persisting the change.
4. WHEN a user turns off the biometric lock toggle, THE Security_Section SHALL invoke `useBiometricLock.disableBiometric` and require a successful biometric authentication before persisting the change.
5. IF a biometric authentication attempt fails or is cancelled, THEN THE Security_Section SHALL revert the toggle to its previous state.

---

### Requirement 7: Wallet Address Storage at Login

**User Story:** As a developer, I want the wallet address stored in SecureStore at login time, so that the Settings screen can display it without calling the backend.

#### Acceptance Criteria

1. WHEN a user successfully authenticates, THE Authentication_Flow SHALL store the wallet address string in SecureStore under the key `wallet_address`.
2. WHEN a user signs out, THE Authentication_Flow SHALL delete the `wallet_address` entry from SecureStore.
