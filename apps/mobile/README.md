# Vaultix Mobile

The Vaultix (QuickEx) mobile client — an [Expo](https://docs.expo.dev/) app built with **Expo SDK 52**, **React Native 0.76.5**, **React 18.3.1**, TypeScript and [Expo Router](https://docs.expo.dev/router/introduction/) v4.

It talks to the Vaultix NestJS backend in [`apps/backend`](../backend) and to a Stellar RPC endpoint.

---

## 1. Prerequisites

| Requirement | Version / Notes |
| --- | --- |
| **Node.js** | `>= 18.18` — **20.x LTS recommended** (Expo SDK 52 supports Node 18/20/22; CI runs Node 20). Odd-numbered releases (19, 21, 23) are not supported. |
| **pnpm** | `>= 9`. Install with `npm install -g pnpm` or `corepack enable pnpm`. |
| **Expo CLI** | Do **not** install `expo-cli` globally (deprecated). The modern CLI ships with the `expo` package — invoke it as `npx expo <command>`; the package scripts already do this via `expo start`. |
| **Watchman** (macOS/Linux, optional) | Improves Metro file watching: `brew install watchman`. |
| **Android Studio** | Required only for the Android emulator / native builds. Install Android Studio, then in **SDK Manager** install the *Android SDK Platform 34/35*, *Android SDK Build-Tools* and *Android Emulator*, create a device in **Device Manager**, and export `ANDROID_HOME` (`~/Library/Android/sdk` on macOS, `~/Android/Sdk` on Linux) plus `$ANDROID_HOME/platform-tools` on your `PATH`. |
| **Xcode** | macOS only, required for the iOS simulator / native builds. Install Xcode 15 or newer from the App Store, then `xcode-select --install` and open Xcode once to install the iOS simulator runtime. |

You do **not** need Android Studio or Xcode to develop against **Expo Go** or the web target — `pnpm start` prints a QR code you can scan with the Expo Go app on a physical device.

---

## 2. Installation

Clone the monorepo and install dependencies:

```bash
# 1. From the repository root — installs root-level tooling (ESLint, Prettier)
git clone https://github.com/paris27-A/Vaultix.git
cd Vaultix
pnpm install

# 2. Install the mobile app's own dependencies (apps/mobile has its own lockfile)
cd apps/mobile
pnpm install
```

`apps/mobile` keeps its own `pnpm-lock.yaml`, so the second install is required — the root install does not hoist the Expo/React Native dependency tree into the app.

Verify the toolchain:

```bash
node -v          # v20.x
pnpm -v          # 9.x or newer
npx expo --version
```

---

## 3. Environment Variables

Expo only exposes variables prefixed with `EXPO_PUBLIC_` to the JavaScript bundle. Create an **`apps/mobile/.env`** file (it is git-ignored) — Expo loads it automatically when Metro starts.

> ⚠️ `EXPO_PUBLIC_*` values are inlined into the JavaScript bundle at build time and are readable by anyone with the app binary. Never put secrets, private keys or API tokens in them.

### Variables read by `security/env.ts`

| Variable | Purpose | Default when unset |
| --- | --- | --- |
| `EXPO_PUBLIC_APP_ENV` | Selects the config profile in `security/env.ts`. One of `dev`, `testnet`, `production`. | `dev` |
| `EXPO_PUBLIC_API_URL` | Backend REST base URL exposed as `envConfig.apiUrl`. | `http://localhost:3000` (dev), `https://api-testnet.vaultix.com` (testnet), `https://api.vaultix.com` (production) |
| `EXPO_PUBLIC_RPC_URL` | Blockchain RPC endpoint exposed as `envConfig.rpcUrl`. | `http://127.0.0.1:8545` (dev), `https://rpc-testnet.vaultix.com` (testnet), `https://rpc.vaultix.com` (production) |

### Additional `EXPO_PUBLIC_*` variables used elsewhere in the app

| Variable | Used in | Purpose | Default when unset |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | `services/api.ts` | `baseURL` of the Axios client that performs **all** HTTP calls. Set it to the same value as `EXPO_PUBLIC_API_URL`. | `http://localhost:3000` |
| `EXPO_PUBLIC_AUTH_PATH_PREFIX` | `services/api.ts` | Path prefix for the URI-versioned auth routes on the NestJS backend. Override only when a gateway/proxy rewrites them. | `/v1/auth` |
| `EXPO_PUBLIC_WEB_BASE_URL` | `components/ShareButton.tsx` | Base URL used to build shareable escrow/invite links. | `https://vaultix.app` |

### Example: local development (`.env`)

```dotenv
EXPO_PUBLIC_APP_ENV=dev
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_AUTH_PATH_PREFIX=/v1/auth
EXPO_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
EXPO_PUBLIC_WEB_BASE_URL=http://localhost:3001
```

### Example: testnet

```dotenv
EXPO_PUBLIC_APP_ENV=testnet
EXPO_PUBLIC_API_URL=https://api-testnet.vaultix.com
EXPO_PUBLIC_API_BASE_URL=https://api-testnet.vaultix.com
EXPO_PUBLIC_AUTH_PATH_PREFIX=/v1/auth
EXPO_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
EXPO_PUBLIC_WEB_BASE_URL=https://testnet.vaultix.app
```

### Example: production

```dotenv
EXPO_PUBLIC_APP_ENV=production
EXPO_PUBLIC_API_URL=https://api.vaultix.com
EXPO_PUBLIC_API_BASE_URL=https://api.vaultix.com
EXPO_PUBLIC_AUTH_PATH_PREFIX=/v1/auth
EXPO_PUBLIC_RPC_URL=https://rpc.vaultix.com
EXPO_PUBLIC_WEB_BASE_URL=https://vaultix.app
```

Environment changes are picked up when Metro restarts — stop the dev server and run `pnpm start -- --clear` after editing `.env`.

---

## 4. Available Scripts

Run all of these from `apps/mobile`.

| Command | What it does |
| --- | --- |
| `pnpm start` | Runs `expo start` — starts the Metro bundler and prints a QR code / dev-server URL. Press `a` for Android, `i` for iOS, `w` for web, `r` to reload, `j` to open the debugger. |
| `pnpm android` | Runs `expo start --android` — starts Metro and launches the app on a running Android emulator or a USB-connected device (`adb devices` must list it). |
| `pnpm ios` | Runs `expo start --ios` — starts Metro and launches the app in the iOS simulator (macOS + Xcode only). |
| `pnpm lint` | Runs `eslint . --ext .ts,.tsx` using `.eslintrc.js` (TypeScript parser + `@typescript-eslint` recommended rules). |
| `pnpm type-check` | Runs `tsc --noEmit` using `tsconfig.json` (strict mode, `@/*` path alias). |
| `pnpm test` | Runs the Jest suite with the `jest-expo` preset over `__tests__/`, `utils/*.test.ts` and `services/cache/*.test.ts`. |

Useful one-offs (no dedicated script):

```bash
npx expo start -c            # start with a cleared Metro cache
npx expo start --tunnel      # expose the dev server through a tunnel (device on another network)
npx expo-doctor              # diagnose dependency/version mismatches against SDK 52
```

---

## 5. Running Against a Local Backend

1. Start the backend (defaults to port `3000`):

   ```bash
   cd apps/backend
   npm install
   npm run start:dev
   ```

2. Point the mobile app at it in `apps/mobile/.env`. **The host you use depends on where the app runs:**

   | Where the app runs | Host to use in `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_API_BASE_URL` |
   | --- | --- |
   | iOS simulator | `http://localhost:3000` |
   | **Android emulator (AVD)** | **`http://10.0.2.2:3000`** — inside the emulator, `localhost` refers to the emulator itself, and `10.0.2.2` is the special loopback alias for the host machine. |
   | Genymotion emulator | `http://10.0.3.2:3000` |
   | Physical device (Expo Go, same Wi‑Fi) | Your machine's LAN IP, e.g. `http://192.168.1.42:3000` (find it with `ipconfig getifaddr en0` on macOS or `hostname -I` on Linux). |

   Android emulator example:

   ```dotenv
   EXPO_PUBLIC_APP_ENV=dev
   EXPO_PUBLIC_API_URL=http://10.0.2.2:3000
   EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000
   ```

3. Restart Metro so the new values are inlined:

   ```bash
   pnpm start -- --clear
   ```

4. If requests fail, forward the port instead of relying on the loopback alias:

   ```bash
   adb reverse tcp:3000 tcp:3000   # then use http://localhost:3000 from the emulator/device
   ```

Note: Android blocks cleartext HTTP in release builds. Plain `http://` local URLs work in Expo Go and debug builds; use `https://` for anything shipped.

---

## 6. Project Structure

```
apps/mobile
├── app/                # Expo Router routes — the file tree is the navigation tree
│   ├── _layout.tsx     # root layout / providers
│   ├── (tabs)/         # tab navigator: dashboard, notifications, settings
│   ├── escrow/         # escrow screens: [id], create, release
│   └── invite/         # invite acceptance screen: [token]
├── components/         # Reusable presentational components (Toast, QRScannerModal, banners, …)
├── hooks/              # Reusable React hooks (useSession, useBiometricLock, useNetworkStatus, caches, …)
├── services/           # I/O layer: Axios API client, auth/session, wallet, QR scanning,
│                       # notifications and the `cache/` offline read-through caches
├── security/           # Security-sensitive configuration — `env.ts` resolves the active
│                       # environment (dev/testnet/production) and its API/RPC URLs
├── utils/              # Framework-agnostic helpers: error mapping, network checks, retry,
│                       # SecureStore wrappers, QR payload validation
├── types/              # Shared TypeScript types (escrow, notification, qr) and ambient declarations
├── __tests__/          # Jest test suites
├── app.json            # Expo app config (scheme `vaultix`, bundle id `io.vaultix.mobile`)
├── .eslintrc.js        # ESLint config for the app sources
├── babel.config.js     # Babel config (`babel-preset-expo`)
└── tsconfig.json       # Strict TypeScript config with the `@/*` path alias
```

| Directory | Purpose |
| --- | --- |
| `app/` | Screens and navigation. Expo Router maps each file to a route; `[id].tsx` are dynamic segments and `(tabs)` is a route group rendered as a tab bar. Typed routes are enabled. |
| `components/` | Stateless/reusable UI building blocks shared across screens. No network calls belong here. |
| `hooks/` | Stateful logic reused by screens — session hydration, biometric lock, connectivity, dashboard/escrow caching, notifications, app-version checks. |
| `services/` | All external communication: the Axios instance and endpoint wrappers (`api.ts`), auth/session token handling, Stellar wallet interactions, QR scanning, notification delivery, and cache persistence. |
| `security/` | Environment and security configuration. `env.ts` exports `envConfig` (`environment`, `apiUrl`, `rpcUrl`) plus `validateEnv()`; change environment behaviour here rather than hard-coding URLs. |
| `utils/` | Pure helpers with no React dependency — error normalisation, retry/backoff, network probes, SecureStore access, QR validation. |

---

## 7. Troubleshooting

**Metro cache / stale bundle or "unable to resolve module"**

```bash
npx expo start -c        # clears the Metro cache and restarts
```

Also clears stale `.env` values. If it persists, remove caches and reinstall:

```bash
rm -rf node_modules .expo
pnpm install
npx expo start -c
```

**Node version mismatch** — symptoms are `SyntaxError: Unexpected token '?'`, `ERR_OSSL_EVP_UNSUPPORTED`, or Metro crashing on start:

```bash
node -v            # must be >= 18.18, 20.x LTS recommended
nvm install 20 && nvm use 20     # or: fnm use 20 / volta install node@20
rm -rf node_modules && pnpm install
```

**Dependency installation issues**

- `ERR_PNPM_OUTDATED_LOCKFILE` in CI or after editing `package.json`: run `pnpm install --no-frozen-lockfile` locally and commit the updated `pnpm-lock.yaml`.
- Peer-dependency errors: `pnpm install --strict-peer-dependencies=false`.
- Wrong package versions for the SDK: `npx expo install --check` lists mismatches and `npx expo install --fix` pins the SDK 52-compatible versions.
- Corrupted store or partial install: `rm -rf node_modules pnpm-lock.yaml && pnpm store prune && pnpm install` (re-resolves from `package.json`).

**Jest fails with `SyntaxError: Unexpected identifier 'ErrorHandler'`**

pnpm's symlinked layout places React Native packages under `node_modules/.pnpm/<pkg>@<version>/node_modules/...`, which the stock `jest-expo` `transformIgnorePatterns` do not match, so Flow-typed RN sources are never transpiled. The `jest.transformIgnorePatterns` entry in `package.json` accounts for the extra `.pnpm/<pkg>@<version>/node_modules/` segment — if you see this error, make sure you have not overridden it locally.

**Emulator / device connection issues**

- `adb devices` lists nothing: start the AVD from Android Studio's Device Manager, or `emulator -list-avds && emulator -avd <name>`; run `adb kill-server && adb start-server` if it stays offline.
- App loads but every request fails: you are using `localhost` inside the Android emulator — switch to `10.0.2.2` (see §5) or run `adb reverse tcp:3000 tcp:3000`.
- Expo Go on a physical device can't reach Metro: the phone must be on the same Wi‑Fi as your machine; otherwise use `npx expo start --tunnel`. Allow Node through your firewall on port `8081`.
- Port `8081` already in use: `npx expo start --port 8082`, or kill the process with `lsof -ti:8081 | xargs kill`.
- iOS simulator does not open: run `open -a Simulator` first, and ensure `xcode-select -p` points at your Xcode installation.

**`pnpm lint` prints warnings**

Unused-import and `no-explicit-any` findings are reported as warnings, so the command exits `0`. Only errors fail the script.

Report anything else in [GitHub Issues](https://github.com/paris27-A/Vaultix/issues), and see the root [README](../../README.md) and [CONTRIBUTING.md](../../CONTRIBUTING.md) for repository-wide workflow.
