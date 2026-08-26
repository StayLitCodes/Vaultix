# Vaultix Mobile

The Vaultix mobile client — an [Expo](https://docs.expo.dev/) (SDK 52) / React Native 0.76 app using
[Expo Router](https://docs.expo.dev/router/introduction/) for navigation. It talks to the Vaultix
NestJS backend in `apps/backend` and to the Stellar network.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Installation](#2-installation)
3. [Environment Variables](#3-environment-variables)
4. [Available Scripts](#4-available-scripts)
5. [Running Against a Local Backend](#5-running-against-a-local-backend)
6. [Project Structure](#6-project-structure)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Prerequisites

| Requirement | Version / Notes |
| --- | --- |
| **Node.js** | `>= 18.18.0`; **Node 20 LTS is recommended**. Expo SDK 52 supports Node 18.18+, 20 and 22. Node 21 and odd-numbered releases are not supported. |
| **pnpm** | `>= 8`. This monorepo uses pnpm; install with `npm install -g pnpm`. Do not mix in `npm install`/`yarn` inside `apps/mobile`. |
| **Expo CLI** | Do **not** install the deprecated global `expo-cli`. The modern CLI ships with the `expo` package and is invoked as `npx expo <command>` (the package scripts already do this via `expo start`). |
| **Expo Go** (optional) | Easiest way to run the app on a physical device — install "Expo Go" from the App Store / Play Store. It must be the Expo Go build for SDK 52. |
| **Android Studio** | Required to run the Android emulator. Install Android Studio, then in *SDK Manager* install the **Android SDK Platform 34+**, **Android SDK Build-Tools**, and **Android Emulator**, and create a device in *Device Manager*. Set `ANDROID_HOME` (e.g. `~/Library/Android/sdk` on macOS, `~/Android/Sdk` on Linux) and add `$ANDROID_HOME/platform-tools` to your `PATH`. |
| **Xcode** (macOS only) | Required to run the iOS simulator: Xcode 15+ from the Mac App Store, plus the iOS Simulator runtime and Command Line Tools (`xcode-select --install`). iOS development is not possible on Windows or Linux — use Expo Go on a physical device or the Android emulator instead. |

Verify your toolchain:

```bash
node --version    # v20.x recommended
pnpm --version    # 8.x or newer
```

---

## 2. Installation

```bash
# 1. Clone the monorepo and install shared/root dependencies
git clone https://github.com/paris27-A/Vaultix.git
cd Vaultix
pnpm install

# 2. Install the mobile app's dependencies
cd apps/mobile
pnpm install
```

`apps/mobile` keeps its own `package.json` and `pnpm-lock.yaml`, so the second step is required —
running `pnpm install` only at the repository root does not install the Expo/React Native
dependencies.

> **If you intend to run the Jest suite**, install with a flat `node_modules` layout instead:
>
> ```bash
> pnpm install --node-linker=hoisted
> ```
>
> pnpm's default symlinked layout breaks the `jest-expo` transform of React Native's sources — see
> [Known issues with these scripts](#known-issues-with-these-scripts).

The install prints peer-dependency warnings about `react-dom` (pulled in by `jest-expo` and
`expo-router`). They are expected for a React Native-only app and safe to ignore.

Then start the dev server:

```bash
pnpm start
```

Expo prints a QR code and a dev-server URL. Press `a` to open the Android emulator, `i` for the iOS
simulator (macOS), or scan the QR code with Expo Go on a physical device.

---

## 3. Environment Variables

Expo only exposes variables prefixed with `EXPO_PUBLIC_` to the app bundle. Because they are
**embedded in the client bundle, never put secrets in them.**

Create `apps/mobile/.env` (it is git-ignored) and restart the dev server after any change —
`EXPO_PUBLIC_*` values are inlined at bundle time, so a running Metro server will not pick them up.

### Variables read by `security/env.ts`

| Variable | Purpose | Default if unset |
| --- | --- | --- |
| `EXPO_PUBLIC_APP_ENV` | Selects the environment profile in `security/env.ts`. One of `dev`, `testnet`, `production`. Every other value falls back to `dev`. | `dev` |
| `EXPO_PUBLIC_API_URL` | Base URL of the Vaultix backend API used by the selected profile. | `http://localhost:3000` (dev), `https://api-testnet.vaultix.com` (testnet), `https://api.vaultix.com` (production) |
| `EXPO_PUBLIC_RPC_URL` | Blockchain RPC endpoint used by the selected profile for on-chain reads/writes. | `http://127.0.0.1:8545` (dev), `https://rpc-testnet.vaultix.com` (testnet), `https://rpc.vaultix.com` (production) |

Note that `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_RPC_URL` override the profile defaults for
*whichever* profile is active — they are not per-profile variables.

### Other variables used by the app

| Variable | Purpose | Default if unset |
| --- | --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | Base URL used by the axios client in `services/api.ts` (escrows, disputes, notifications). Set it to the same value as `EXPO_PUBLIC_API_URL`. | `http://localhost:3000` |
| `EXPO_PUBLIC_AUTH_PATH_PREFIX` | Path prefix for the URI-versioned auth routes on the backend. Only change this if you run a gateway/proxy that rewrites auth paths. | `/v1/auth` |
| `EXPO_PUBLIC_WEB_BASE_URL` | Base URL used by `components/ShareButton.tsx` to build shareable escrow/invite links. | `https://vaultix.app` |

### Example: development (local backend, iOS simulator / Expo Go on the same machine)

```env
EXPO_PUBLIC_APP_ENV=dev
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_RPC_URL=http://127.0.0.1:8545
EXPO_PUBLIC_AUTH_PATH_PREFIX=/v1/auth
EXPO_PUBLIC_WEB_BASE_URL=http://localhost:3001
```

### Example: testnet

```env
EXPO_PUBLIC_APP_ENV=testnet
EXPO_PUBLIC_API_URL=https://api-testnet.vaultix.com
EXPO_PUBLIC_API_BASE_URL=https://api-testnet.vaultix.com
EXPO_PUBLIC_RPC_URL=https://rpc-testnet.vaultix.com
EXPO_PUBLIC_AUTH_PATH_PREFIX=/v1/auth
EXPO_PUBLIC_WEB_BASE_URL=https://testnet.vaultix.app
```

### Example: production

```env
EXPO_PUBLIC_APP_ENV=production
EXPO_PUBLIC_API_URL=https://api.vaultix.com
EXPO_PUBLIC_API_BASE_URL=https://api.vaultix.com
EXPO_PUBLIC_RPC_URL=https://rpc.vaultix.com
EXPO_PUBLIC_AUTH_PATH_PREFIX=/v1/auth
EXPO_PUBLIC_WEB_BASE_URL=https://vaultix.app
```

---

## 4. Available Scripts

Run all of these from `apps/mobile`.

| Command | What it does |
| --- | --- |
| `pnpm start` | Runs `expo start` — starts the Metro bundler and dev server, and prints a QR code for Expo Go plus interactive keys (`a` Android, `i` iOS, `r` reload, `j` debugger). |
| `pnpm android` | Runs `expo start --android` — starts the dev server and opens the app on a running Android emulator or a USB-connected device (requires Android Studio / `adb`). |
| `pnpm ios` | Runs `expo start --ios` — starts the dev server and opens the app in the iOS Simulator (macOS with Xcode only). |
| `pnpm lint` | Runs `eslint . --ext .ts,.tsx` over the mobile sources. |
| `pnpm type-check` | Runs `tsc --noEmit` — type-checks the app in strict mode without emitting output. Run this before pushing. |
| `pnpm test` | Runs the Jest suite (`jest-expo` preset) over `__tests__/` and co-located `*.test.ts` files. Use `pnpm test -- --watch` while developing and `pnpm test -- --coverage` for a coverage report. |

### Known issues with these scripts

Three of the scripts currently fail on a clean checkout for reasons unrelated to your changes. They
are listed here so you do not lose time debugging your own environment; fixing them requires
changes outside this README.

| Command | Symptom | Cause / workaround |
| --- | --- | --- |
| `pnpm lint` | `ESLint couldn't find an eslint.config.js file` | Neither `apps/mobile` nor the repository root ships an ESLint flat config (ESLint 9+ requires `eslint.config.js`), so the root `pnpm lint` fails the same way. Until a config is added, use `pnpm type-check` as the pre-push check. |
| `pnpm test` | Every suite fails immediately with `SyntaxError: Unexpected identifier 'ErrorHandler'` in `@react-native/js-polyfills` | pnpm's default symlinked `node_modules` layout puts React Native under `node_modules/.pnpm/...`, so the `jest-expo` transform ignore patterns never match and RN's Flow-typed sources are left untransformed. Reinstall with a flat layout: `pnpm install --node-linker=hoisted`. After that the suite runs; 3 of 8 suites still fail for pre-existing reasons (`api.test.ts`: `Cannot find module 'expo/virtual/env'`; `session.test.ts` and `walletAuth.test.ts`: sandbox globals). |
| `pnpm type-check` | `TS1005`/`TS1127` parse errors in `app/escrow/create.tsx` | Pre-existing syntax damage in that file (literal `\n` sequences inside JSX), not a configuration problem. Other files still type-check. |

---

## 5. Running Against a Local Backend

1. Start the backend (see `apps/backend/README.md` and the root `README.md`). It listens on
   `http://localhost:3000` by default:

   ```bash
   cd apps/backend
   pnpm install
   pnpm start:dev
   ```

2. Point the mobile app at it in `apps/mobile/.env`, using the host that is reachable **from where
   the app is running**:

   | Where the app runs | Host to use |
   | --- | --- |
   | iOS Simulator (macOS) | `http://localhost:3000` |
   | **Android emulator** | **`http://10.0.2.2:3000`** — inside the Android emulator, `localhost` refers to the emulator itself, not your development machine. `10.0.2.2` is the emulator's loopback alias for the host machine. (Genymotion uses `10.0.3.2` instead.) |
   | Physical device (Expo Go) | Your machine's LAN IP, e.g. `http://192.168.1.42:3000`. The device and computer must be on the same network, and the backend must bind to `0.0.0.0`, not only `127.0.0.1`. |

   Android emulator example:

   ```env
   EXPO_PUBLIC_APP_ENV=dev
   EXPO_PUBLIC_API_URL=http://10.0.2.2:3000
   EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000
   EXPO_PUBLIC_RPC_URL=http://10.0.2.2:8545
   ```

3. Restart Metro so the new values are inlined into the bundle:

   ```bash
   pnpm start -- --clear
   ```

> **Plain HTTP:** Android 9+ and iOS block cleartext HTTP by default for release builds. The URLs
> above work in Expo Go / debug builds; use HTTPS endpoints for any standalone build.

---

## 6. Project Structure

```
apps/mobile/
├── app/           # Screens and routes (Expo Router, file-system based)
├── components/    # Reusable presentational UI components
├── hooks/         # Reusable React hooks (state, caching, device features)
├── services/      # API clients, session/auth, wallet, cache layer
├── security/      # Environment configuration and security helpers
├── utils/         # Framework-agnostic helper functions
├── types/         # Shared TypeScript types (escrow, notification, qr)
├── __tests__/     # Jest test suites
├── app.json       # Expo app config (name, scheme, plugins, bundle IDs)
└── tsconfig.json  # TypeScript config; `@/*` maps to the app root
```

| Directory | Purpose |
| --- | --- |
| `app/` | Route definitions for Expo Router. Every file is a screen and the file path *is* the URL: `app/dashboard.tsx` → `/dashboard`, `app/escrow/[id].tsx` → `/escrow/:id`, `app/(tabs)/` → the tab navigator, `_layout.tsx` files define nested layouts, and `not-found.tsx` is the fallback route. |
| `components/` | Shared, mostly stateless UI building blocks used across screens (e.g. `Toast`, `OfflineBanner`, `QRScannerModal`, `ShareButton`). No routing or network logic. |
| `hooks/` | Custom React hooks encapsulating stateful behaviour: session handling (`useSession`), biometric lock (`useBiometricLock`), network status (`useNetworkStatus`), cached dashboard/escrow data, notifications and app-version checks. |
| `services/` | The app's integration layer: the axios API client (`api.ts`), authentication and session token storage (`auth.ts`, `session.ts`, `walletAuth.ts`), Stellar wallet interaction (`wallet.ts`), QR scanning (`qrScanner.ts`), notifications, and the offline `cache/` layer. |
| `security/` | Security-sensitive configuration. `env.ts` resolves the active environment profile (`dev` / `testnet` / `production`) and exposes `envConfig` (`apiUrl`, `rpcUrl`) plus `validateEnv()`. Change environment defaults here, not in feature code. |
| `utils/` | Small pure helpers with no UI dependencies: error normalisation (`errors.ts`), network helpers (`network.ts`), retry/backoff (`retry.ts`), secure storage wrappers over `expo-secure-store` (`secureStore.ts`), and QR payload validation (`qrValidation.ts`). |

---

## 7. Troubleshooting

### Metro bundler serves stale code / "Unable to resolve module"

Clear the Metro and Expo caches:

```bash
pnpm start -- --clear     # equivalent to: npx expo start -c
```

If that is not enough, remove the transient caches and reinstall:

```bash
rm -rf node_modules .expo
pnpm install
npx expo start -c
```

### Node version mismatch

Symptoms: install or bundling errors mentioning an unsupported engine, `SyntaxError` in a
dependency, or the dev server exiting immediately.

```bash
node --version   # must be >= 18.18.0; use Node 20 LTS if unsure
```

Switch versions with a version manager, e.g.:

```bash
nvm install 20 && nvm use 20
```

Then reinstall so native/bundled artifacts are rebuilt for the active Node version:

```bash
rm -rf node_modules && pnpm install
```

### Dependency installation issues

- Always use `pnpm` in this repo. A stray `package-lock.json` or `yarn.lock` inside `apps/mobile`
  means a wrong package manager was used — delete it, delete `node_modules`, and rerun
  `pnpm install`.
- After a failed or interrupted install:
  ```bash
  rm -rf node_modules
  pnpm store prune
  pnpm install
  ```
- To confirm every dependency matches what Expo SDK 52 expects:
  ```bash
  npx expo install --check     # add --fix to apply the suggested versions
  ```
- Install new packages with `npx expo install <pkg>` rather than `pnpm add <pkg>`; it selects the
  version compatible with the installed SDK.

### Emulator / device connection issues

- **Android emulator not detected** by `pnpm android`: make sure the emulator is already running and
  visible to `adb`:
  ```bash
  adb devices          # the emulator should be listed as "device"
  adb kill-server && adb start-server
  ```
  Also confirm `ANDROID_HOME` is set and `$ANDROID_HOME/platform-tools` is on your `PATH`.
- **iOS Simulator does not open**: run `xcode-select --install`, open Xcode once to accept the
  license, and confirm a simulator runtime is installed under *Xcode → Settings → Platforms*.
- **App loads but every request fails / times out**: this is almost always the API host. Use
  `10.0.2.2` on the Android emulator and your LAN IP on a physical device — see
  [Running Against a Local Backend](#5-running-against-a-local-backend). Verify the backend is
  reachable from the host first with `curl http://localhost:3000`.
- **Physical device cannot reach the dev server**: the device and computer must be on the same
  Wi-Fi network with client isolation disabled. If the LAN is restricted, use a tunnel:
  ```bash
  npx expo start --tunnel
  ```
- **Port already in use**: another Metro instance is running. Stop it, or start on another port with
  `npx expo start --port 8082`.
