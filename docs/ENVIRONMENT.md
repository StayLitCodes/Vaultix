# Environment Variables

This document lists every environment variable used across the Vaultix monorepo, grouped by owning service.

> **Issue #579:** Configuration was previously scattered and undocumented. Contributors discovered required
> variables by hitting runtime errors. This file is the single canonical reference.

---

## Conflict & Duplicate Register

The following variables were identified as conflicting or duplicated. The **canonical** name is listed first.

| Conflicting variable | Canonical variable | Service | Resolution |
|---|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | `EXPO_PUBLIC_API_URL` | Mobile | **Removed** in #557 — `services/api.ts` now imports from `security/env.ts` |
| `NEXT_PUBLIC_API_BASE_URL` | `NEXT_PUBLIC_API_URL` | Frontend | `escrow-api.ts` still reads `NEXT_PUBLIC_API_BASE_URL` for a URL-stripping helper; **should be migrated to `NEXT_PUBLIC_API_URL`** |
| `API_BASE_URL` | `PORT` / `NEXT_PUBLIC_API_URL` | Backend (email config) | `API_BASE_URL` is used only to build an email verification link; consider migrating to `FRONTEND_URL` |

---

## Backend (`apps/backend`)

| Variable | Required | Secret | Default | Purpose |
|---|---|---|---|---|
| `PORT` | No | No | `3000` | HTTP listen port for the NestJS API |
| `NODE_ENV` | No | No | — | Runtime environment (`development`, `production`, `test`) |
| `DATABASE_PATH` | No | No | `./data/vaultix.db` | SQLite database file path |
| `JWT_SECRET` | **Yes** | **Yes** | — | Secret used to sign JWT auth tokens |
| `STELLAR_NETWORK` | No | No | `testnet` | Stellar network (`testnet` or `mainnet`) |
| `STELLAR_NETWORK_PASSPHRASE` | No | No | Derived from `STELLAR_NETWORK` | Stellar network passphrase |
| `STELLAR_RPC_URL` | No | No | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint |
| `STELLAR_CONTRACT_ID` | **Yes** | No | — | Deployed escrow contract ID on Soroban |
| `STELLAR_TIMEOUT` | No | No | `60000` | RPC call timeout in ms |
| `STELLAR_MAX_RETRIES` | No | No | `3` | Max RPC retry attempts |
| `STELLAR_RETRY_DELAY` | No | No | `1000` | Base retry delay in ms |
| `HORIZON_URL` | No | No | Derived from `STELLAR_NETWORK` | Stellar Horizon server URL |
| `WALLET_SECRET` | **Yes** | **Yes** | — | Secret key for the backend escrow wallet |
| `CORS_ORIGINS` | No | No | — | Comma-separated list of allowed CORS origins |
| `FRONTEND_URL` | No | No | `http://localhost:3001` | Frontend URL, used for WebSocket origin checks |
| `API_BASE_URL` | No | No | `http://localhost:3000` | Backend URL, used for email verification link construction |
| `REQUEST_LOG_SLOW_THRESHOLD_MS` | No | No | `5000` | Slow-request logging threshold in ms |
| `IPFS_PROVIDER` | No | No | `pinata` | IPFS storage provider (`pinata` or `local`) |
| `IPFS_GATEWAY_URL` | No | No | `https://gateway.pinata.cloud/ipfs/` | IPFS gateway URL |
| `IPFS_LOCAL_NODE_URL` | No | No | `http://localhost:5001` | Local IPFS node URL |
| `IPFS_MAX_RETRIES` | No | No | `1` | Max IPFS upload retries |
| `PINATA_API_KEY` | No | **Yes** | — | Pinata API key |
| `PINATA_SECRET_API_KEY` | No | **Yes** | — | Pinata secret API key |
| `PINATA_JWT` | No | **Yes** | — | Pinata JWT token (alternative to API key + secret) |
| `SMTP_HOST` | No | No | — | SMTP server host |
| `SMTP_PORT` | No | No | `587` | SMTP server port |
| `SMTP_USER` | No | **Yes** | — | SMTP username |
| `SMTP_PASS` | No | **Yes** | — | SMTP password |
| `EMAIL_FROM` | No | No | `no-reply@vaultix.local` | From address for outgoing emails |
| `EMAIL_MAX_ATTEMPTS` | No | No | `5` | Max email send retry attempts |
| `EMAIL_RETRY_BASE_DELAY_MS` | No | No | `60000` | Base delay for email retries in ms |
| `EMAIL_VERIFICATION_BASE_URL` | No | No | `API_BASE_URL + /auth/profile/verify-email` | Base URL for email verification links |
| `WEBHOOK_MAX_ATTEMPTS` | No | No | `6` | Max webhook delivery attempts |
| `WEBHOOK_RETRY_SCHEDULE_MS` | No | No | — | Comma-separated retry delays in ms |
| `WEBHOOK_REQUEST_TIMEOUT_MS` | No | No | `30000` | Webhook request timeout in ms |
| `WEBHOOK_ALERT_FAILURE_RATE_THRESHOLD` | No | No | `25` | Failure rate % that triggers an alert |
| `WEBHOOK_ALERT_MIN_DELIVERIES` | No | No | `10` | Min deliveries before alerting |
| `WEBHOOK_ALERT_WINDOW_MINUTES` | No | No | `60` | Alert window in minutes |
| `VITE_API_URL` | No | No | `http://localhost:3001` | Used by backend's test client (`src/clients/client.ts`) |

---

## Frontend (`apps/frontend` — Next.js)

| Variable | Required | Secret | Default | Purpose |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | **Yes** | No | `http://localhost:3000` | Backend API base URL |
| `NEXT_PUBLIC_API_BASE_URL` | No | No | — | **Deprecated/conflicting** — used only in `escrow-api.ts` for URL stripping. Should be migrated to `NEXT_PUBLIC_API_URL`. |
| `NEXT_PUBLIC_STELLAR_NETWORK` | No | No | `testnet` | Stellar network for wallet connections |
| `NEXT_PUBLIC_WS_URL` | No | No | `http://localhost:3000` | WebSocket URL for real-time updates |
| `CI` | No | No | — | Set by CI runners; controls Playwright retry behaviour |

---

## Mobile (`apps/mobile` — Expo / React Native)

| Variable | Required | Secret | Default | Purpose |
|---|---|---|---|---|
| `EXPO_PUBLIC_APP_ENV` | No | No | `dev` | Environment selector (`dev`, `testnet`, `production`) |
| `EXPO_PUBLIC_API_URL` | **Yes** | No | Per-env default | Backend API base URL (single source of truth in `security/env.ts`) |
| `EXPO_PUBLIC_RPC_URL` | **Yes** | No | Per-env default | Soroban RPC endpoint URL |
| `EXPO_PUBLIC_AUTH_PATH_PREFIX` | No | No | `/v1/auth` | Auth route prefix (Nest versioning) |
| `EXPO_PUBLIC_WEB_BASE_URL` | No | No | `https://vaultix.app` | Web app base URL for share links |
| `EXPO_PUBLIC_API_BASE_URL` | — | — | — | **Removed** in #557 — was conflicting with `EXPO_PUBLIC_API_URL` |

---

## Onchain Deployment (`apps/onchain`)

No environment variables are read directly by the onchain deployment code. Contract addresses and network
configuration are injected via the backend's `STELLAR_CONTRACT_ID`, `STELLAR_RPC_URL`, and `STELLAR_NETWORK`
variables during deployment scripts.

---

## Cross-Service Variables (Must Agree)

These variables must be consistent across services to avoid drift:

| Variable group | Backend | Frontend | Mobile | Notes |
|---|---|---|---|---|
| **API URL** | `PORT` (listed on) | `NEXT_PUBLIC_API_URL` (points to) | `EXPO_PUBLIC_API_URL` (points to) | All three must resolve to the same backend instance |
| **Stellar Network** | `STELLAR_NETWORK` | `NEXT_PUBLIC_STELLAR_NETWORK` | (derived from `EXPO_PUBLIC_APP_ENV`) | All services must target the same Stellar network |
| **Soroban RPC** | `STELLAR_RPC_URL` | — | `EXPO_PUBLIC_RPC_URL` | Mobile and backend must use the same RPC endpoint |
| **Contract ID** | `STELLAR_CONTRACT_ID` | — | — | Only backend needs this, but the deployed contract must match the network |

---

## Quick Start

### Backend
```bash
# .env
PORT=3000
DATABASE_PATH=./data/vaultix.db
JWT_SECRET=your-secret-here
STELLAR_NETWORK=testnet
STELLAR_CONTRACT_ID=your-contract-id
WALLET_SECRET=your-wallet-secret
```

### Frontend
```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_WS_URL=http://localhost:3000
```

### Mobile
```bash
# .env
EXPO_PUBLIC_APP_ENV=dev
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_RPC_URL=http://127.0.0.1:8000
```
