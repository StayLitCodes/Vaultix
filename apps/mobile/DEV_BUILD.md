# 📱 Vaultix Mobile — Dev Builds

This guide covers how to generate development builds for the Vaultix mobile app and distribute them for internal testing.

---

## Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`pnpm add -g expo-cli`)
- [EAS CLI](https://docs.expo.dev/eas/) (`pnpm add -g eas-cli`)
- Physical device or simulator/emulator
- Apple Developer account (iOS) or Expo account (Android)

---

## Option 1: EAS Build (Recommended)

EAS (Expo Application Services) builds the app in the cloud and is the easiest way to produce shareable dev builds.

### 1. Install EAS CLI

```bash
pnpm add -g eas-cli
```

### 2. Log in to Expo

```bash
eas login
```

### 3. Configure EAS

Create an `eas.json` file at the **root of the mobile app** (`apps/mobile/eas.json`):

```json
{
  "cli": {
    "version": ">= 3.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development"
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview"
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

### 4. Build for Development

```bash
# From apps/mobile
eas build --profile development --platform all
```

**Platform-specific builds:**

```bash
# iOS only
eas build --profile development --platform ios

# Android only
eas build --profile development --platform android
```

### 5. What Happens

- EAS uploads your project to Expo's servers
- Builds the native app (iOS IPA / Android APK/AAB)
- Downloads the build artifact or sends it to your registered device(s)

### 6. Install the Build

- **iOS**: Install via the link EAS provides (TestFlight-like) or download the `.ipa` and install via Xcode
- **Android**: Download the `.apk` or `.aab` and install directly on device

### 7. Start the Dev Server

After installing the dev build on your device/emulator:

```bash
cd apps/mobile
npx expo start --dev-client
```

This starts the Metro bundler. Open the app on your device (scan QR code or press `a` for Android / `i` for iOS).

---

## Option 2: Local Dev Build (Expo Dev Client)

Use this when you want to build locally without cloud infrastructure.

### iOS (requires macOS + Xcode)

```bash
# Generate the native iOS project
npx expo prebuild --platform ios

# Open in Xcode and build
cd apps/mobile/ios
pod install
open Vaultix.xcworkspace
# Select a simulator or connected device, then Build & Run (Cmd+R)
```

### Android (requires Android Studio)

```bash
# Generate the native Android project
npx expo prebuild --platform android

# Open in Android Studio
cd apps/mobile/android
open -a "Android Studio" .

# Build APK
cd apps/mobile/android
./gradlew assembleDebug
```

---

## Option 3: Expo Go (Quick Testing)

For quickest feedback without a dev build, use [Expo Go](https://expo.dev/go). Note that custom native modules won't work in Expo Go if you ever add native dependencies beyond what Expo provides out of the box.

```bash
cd apps/mobile
npx expo start
```

Then scan the QR code with **Expo Go** on your device.

---

## Internal Distribution

### iOS — TestFlight via EAS Submit

```bash
# First, ensure you have an App Store Connect API key or Apple ID credentials
eas submit --platform ios --profile production
```

### Android — Internal Testing Track

```bash
eas submit --platform android --profile production
```

Or share the `.apk` directly via a link (if using EAS Build with internal distribution).

---

## Running Checks Before Build

Always run these checks before building to catch issues early:

```bash
# From apps/mobile

# 1. Lint
pnpm lint

# 2. Type check
pnpm type-check

# 3. Run tests
pnpm test

# 4. All three combined
pnpm validate
```

---

## Troubleshooting

### Build fails at "pod install"

```bash
cd apps/mobile/ios
pod deintegrate
pod install --repo-update
```

### Metro bundler can't resolve modules

```bash
cd apps/mobile
pnpm start --clear
# or
npx expo start -c
```

### EAS Build fails

- Check logs in the EAS dashboard
- Ensure `eas.json` has the correct profile
- Verify your Expo account has sufficient build credits
- Try building for a single platform first

### Dev build crashes on launch

- Ensure the Metro dev server is running (`npx expo start --dev-client`)
- Check for native module mismatches in `package.json`
- Clear the dev client cache:
  ```bash
  npx expo start -c
  ```

---

## References

- [Expo Dev Client Docs](https://docs.expo.dev/development/creating-a-development-build/)
- [EAS Build Docs](https://docs.expo.dev/build/introduction/)
- [EAS Submit Docs](https://docs.expo.dev/submit/introduction/)
