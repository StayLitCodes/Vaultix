# Vaultix Mobile

The Vaultix mobile client — an [Expo](https://expo.dev/) / React Native app for
creating and managing Stellar escrows on the go. It talks only to the Vaultix
backend API; it never calls Soroban RPC directly (the backend submits every
transaction), so the app only ever needs to know one thing about the network:
where the backend lives.

This is one of three app packages in the monorepo, alongside
[`apps/backend`](../backend/README.md) and [`apps/frontend`](../frontend/README.md).

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20.x LTS (18.18+ works) | Expo SDK 52 requires Node 18.18 or newer; the repo CI uses Node 20. |
| npm | 10.x | This package ships a `package-lock.json`; use `npm` for reproducible installs. |
| Expo CLI | bundled | Use the local CLI via `npx expo …` (installed with the dependencies). A global `expo-cli` is **not** required. |
| Expo Go / dev build | SDK 52 | The app targets **Expo SDK ~52.0** and **React Native 0.76.5** (new architecture enabled in `app.json`). Use an Expo Go build that matches SDK 52, or a custom dev client. |
| Watchman (optional) | latest | Recommended on macOS for faster file watching. |

> **Version constraint:** Expo SDK 52 pins React Native to 0.76.x. Do not bump
> `react-native` independently of `expo` — upgrade them together through
> `npx expo install` so the versions stay compatible.

---

## Install

From this directory (`apps/mobile`):

```bash
npm install
```

Then create your local environment file from the template:

```bash
cp .env.example .env
```

---

## Environment variables

All mobile configuration is centralized in
[`security/env.ts`](security/env.ts) as `envConfig`. Only `EXPO_PUBLIC_*`
variables are visible to the app at runtime (Expo inlines them at build time).
For the full monorepo-wide reference — including how these relate to the
backend and frontend variables — see
[`docs/ENVIRONMENT.md`](../../docs/ENVIRONMENT.md) (tracked in #755).

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `EXPO_PUBLIC_APP_ENV` | No | `dev` | Selects the config block in `security/env.ts`: one of `dev`, `testnet`, `production`. An unknown value falls back to `dev` with a startup warning. |
| `EXPO_PUBLIC_API_URL` | Recommended | per-env default | Backend API base URL. Read once via `envConfig.apiUrl`. Falls back to the selected environment's default when unset. |
| `EXPO_PUBLIC_AUTH_PATH_PREFIX` | No | `/v1/auth` | Prefix for the URI-versioned auth routes. Override only behind a custom gateway/proxy. |

Per-environment defaults for `EXPO_PUBLIC_API_URL` (used when the variable is unset):

| `EXPO_PUBLIC_APP_ENV` | Default API URL |
|---|---|
| `dev` | `http://localhost:3000` |
| `testnet` | `https://api-testnet.vaultix.com` |
| `production` | `https://api.vaultix.com` |

> **Canonical variable name:** the API base URL is `EXPO_PUBLIC_API_URL`. An
> earlier `EXPO_PUBLIC_API_BASE_URL` naming (tracked in #707 / #755) is **not**
> read by the current code — do not reintroduce it. `validateEnv()` runs on
> startup from `app/_layout.tsx` and logs a notice whenever a default is in use.

---

## Running the app

| Command | What it does |
|---|---|
| `npm start` | Starts the Expo dev server (Metro) with a QR code for Expo Go / a dev client. |
| `npm run android` | Starts Metro and opens the app on a connected Android device or running emulator. |
| `npm run ios` | Starts Metro and opens the app in the iOS Simulator (macOS only). |
| `npm run lint` | Runs ESLint over `.ts`/`.tsx` sources. |
| `npm run type-check` | Runs `tsc --noEmit` — type-checks without emitting. |
| `npm test` | Runs the Jest test suite. |

---

## Pointing the app at a local backend

1. Start the backend (see [`apps/backend/README.md`](../backend/README.md)); it
   listens on `http://localhost:3000` by default.
2. Leave `EXPO_PUBLIC_APP_ENV=dev` (the default), or set `EXPO_PUBLIC_API_URL`
   explicitly to your backend URL.
3. Start the app with `npm start`.

**Android emulator loopback caveat:** an Android emulator cannot reach your
host machine via `localhost` — `localhost` resolves to the emulator itself. Use
the special host-loopback alias `10.0.2.2` instead:

```bash
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 npm run android
```

iOS Simulator and Expo Go on a physical device differ:

- **iOS Simulator** shares the host network, so `http://localhost:3000` works.
- **Physical device (Expo Go)** must use your machine's LAN IP (e.g.
  `http://192.168.1.20:3000`) and be on the same network.

---

## Project layout

| Path | Contents |
|---|---|
| `app/` | Screens and routes (file-based routing via `expo-router`; typed routes are enabled). `_layout.tsx` is the root layout and where `validateEnv()` runs. |
| `components/` | Reusable presentational and container components shared across screens. |
| `hooks/` | Custom React hooks (data fetching, wallet/session state, UI helpers). |
| `services/` | API and device integrations — `api.ts` (axios client + escrow/auth/dispute endpoints), `session.ts`, `wallet.ts`. |
| `security/` | Security-sensitive config and helpers — `env.ts` (environment resolution) and secure-storage wrappers. |
| `utils/` | Small pure helpers (e.g. `retry.ts`). |
| `types/` | Shared TypeScript types, including `escrow.ts` (status model — see [`docs/STATUS_MAPPING.md`](../../docs/STATUS_MAPPING.md)). |
| `docs/` | App-specific docs (biometric lock QA, push notifications, universal links). |
| `__tests__/` | Jest tests. |

---

## Troubleshooting

**Metro cache is stale / weird bundling errors.** Clear the cache and restart:

```bash
npx expo start -c
```

**"Unable to resolve module" after pulling changes.** Dependencies changed —
reinstall:

```bash
rm -rf node_modules && npm install
```

**Expo SDK / React Native version mismatch warnings.** Let Expo pick compatible
versions instead of editing `package.json` by hand:

```bash
npx expo install --check
```

**App can't reach the backend.** Confirm the backend is running, then check the
resolved API URL — the startup console warning from `validateEnv()` prints which
environment and URL are in use. On Android emulators use `10.0.2.2` (see above),
not `localhost`.

**Port 8081 already in use.** Another Metro instance is running. Stop it, or
start on a different port with `npx expo start --port 8082`.

**iOS build tooling errors (macOS).** Ensure Xcode command-line tools are
installed (`xcode-select --install`) and the iOS Simulator is available.
