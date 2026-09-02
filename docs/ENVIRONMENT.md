# Environment Variables Reference

This document lists every environment variable used across the Vaultix monorepo, grouped by service. It is the single source of truth for configuration — contributors should not need to discover variables by hitting runtime errors.

> Linked from [README.md](../README.md) and [CONTRIBUTING.md](../CONTRIBUTING.md).

---

## How to use this document

- **Required** — the service will fail to start or behave incorrectly without this value.
- **Optional** — has a safe default; override for non-default deployments.
- **Secret** — must never be committed to source control. Use a secrets manager (GitHub Secrets, Doppler, etc.) or a local `.env` file that is in `.gitignore`.
- **Safe to commit** — can appear in `.env.example` without security risk.

---

## Variables that must agree across services

These values must be kept in sync. Drift will cause silent failures (CORS errors, wrong network, wrong contract).

| Concept | Backend var | Frontend var | Mobile var |
|---|---|---|---|
| API base URL | `PORT` (determines URL) / `API_BASE_URL` | `NEXT_PUBLIC_API_BASE_URL` | `EXPO_PUBLIC_API_URL` (single source of truth via `security/env.ts`) |
| Stellar network | `STELLAR_NETWORK` | `NEXT_PUBLIC_STELLAR_NETWORK` | `EXPO_PUBLIC_APP_ENV` (`dev`/`testnet`/`production`) |
| RPC endpoint | `STELLAR_RPC_URL` (if overridden) | `NEXT_PUBLIC_RPC_URL` | `EXPO_PUBLIC_RPC_URL` |
| Contract ID | served via `/api/config` or direct env | `NEXT_PUBLIC_CONTRACT_ID` | fetched from API |

> Mobile configuration is centralized in `apps/mobile/security/env.ts` as `envConfig`. Both `services/api.ts` and any wallet/RPC consumers read from `envConfig`, so `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_RPC_URL` (optionally gated by `EXPO_PUBLIC_APP_ENV`) are the only environment variables that need to be set.

---

## Backend (`apps/backend`)

### Database

| Variable | Required | Secret | Default | Purpose |
|---|---|---|---|---|
| `DATABASE_PATH` | ✅ | ❌ | `./data/vaultix.db` | SQLite database file path |

### Authentication

| Variable | Required | Secret | Default | Purpose |
|---|---|---|---|---|
| `JWT_SECRET` | ✅ | ✅ | — | JWT signing secret (minimum 32 characters) |
| `JWT_EXPIRES_IN` | ❌ | ❌ | `15m` | Access token lifetime |

### Server

| Variable | Required | Secret | Default | Purpose |
|---|---|---|---|---|
| `NODE_ENV` | ❌ | ❌ | `development` | Runtime environment |
| `PORT` | ❌ | ❌ | `3000` | HTTP server port |
| `CORS_ORIGINS` | ❌ | ❌ | `http://localhost:3000,...` | Comma-separated allowed CORS origins |
| `ALLOWED_ORIGINS` | ❌ | ❌ | Same as above | Alternative CORS config (same as `CORS_ORIGINS`) |
| `API_BASE_URL` | ❌ | ❌ | `http://localhost:3000` | Used to build absolute links in emails/webhooks |

### Stellar

| Variable | Required | Secret | Default | Purpose |
|---|---|---|---|---|
| `STELLAR_NETWORK` | ✅ | ❌ | `testnet` | `testnet` or `mainnet` |
| `WALLET_SECRET` | ✅ | ✅ | — | Stellar account secret for signing transactions |
| `STELLAR_TIMEOUT` | ❌ | ❌ | `60000` | RPC timeout in ms |
| `STELLAR_MAX_RETRIES` | ❌ | ❌ | `3` | Max submission retries |
| `STELLAR_RETRY_DELAY` | ❌ | ❌ | `1000` | Delay between retries in ms |

### Email (SMTP)

| Variable | Required | Secret | Default | Purpose |
|---|---|---|---|---|
| `SMTP_HOST` | ✅ (if email enabled) | ❌ | — | SMTP server hostname |
| `SMTP_PORT` | ❌ | ❌ | `587` | SMTP port |
| `SMTP_USER` | ✅ (if email enabled) | ✅ | — | SMTP username |
| `SMTP_PASS` | ✅ (if email enabled) | ✅ | — | SMTP password |
| `EMAIL_FROM` | ❌ | ❌ | `no-reply@vaultix.io` | Sender address |
| `EMAIL_MAX_ATTEMPTS` | ❌ | ❌ | `5` | Max delivery attempts |
| `EMAIL_RETRY_BASE_DELAY_MS` | ❌ | ❌ | `60000` | Base retry delay in ms |

### Webhooks

| Variable | Required | Secret | Default | Purpose |
|---|---|---|---|---|
| `WEBHOOK_MAX_ATTEMPTS` | ❌ | ❌ | `6` | Max delivery attempts before dead-letter |
| `WEBHOOK_RETRY_SCHEDULE_MS` | ❌ | ❌ | `60000,...` | Comma-separated backoff schedule in ms |
| `WEBHOOK_REQUEST_TIMEOUT_MS` | ❌ | ❌ | `30000` | Outbound request timeout |
| `WEBHOOK_ALERT_FAILURE_RATE_THRESHOLD` | ❌ | ❌ | `25` | Alert when failure rate (%) exceeds this |
| `WEBHOOK_ALERT_MIN_DELIVERIES` | ❌ | ❌ | `10` | Minimum deliveries before rate alert |
| `WEBHOOK_ALERT_WINDOW_MINUTES` | ❌ | ❌ | `60` | Rolling window for rate calculation |

### App Version Gating

| Variable | Required | Secret | Default | Purpose |
|---|---|---|---|---|
| `APP_MIN_SUPPORTED_VERSION` | ❌ | ❌ | `1.0.0` | Oldest version allowed to connect |
| `APP_LATEST_VERSION` | ❌ | ❌ | `1.0.0` | Current latest version |
| `APP_UPDATE_URL` | ❌ | ❌ | App Store URL | Redirect URL for forced update |

### Database Backups

| Variable | Required | Secret | Default | Purpose |
|---|---|---|---|---|
| `BACKUP_LOCAL_DIR` | ❌ | ❌ | `./data/backups` | Local backup directory |
| `BACKUP_ENCRYPTION_KEY` | ✅ (if backups enabled) | ✅ | — | AES encryption key for backup files (min 32 chars) |
| `BACKUP_S3_BUCKET` | ❌ | ❌ | — | S3 bucket name for off-site backups |
| `BACKUP_S3_PREFIX` | ❌ | ❌ | `vaultix/backups` | S3 key prefix |
| `BACKUP_S3_REGION` | ❌ | ❌ | `us-east-1` | AWS region |
| `BACKUP_S3_ACCESS_KEY` | ❌ | ✅ | — | AWS access key ID |
| `BACKUP_S3_SECRET_KEY` | ❌ | ✅ | — | AWS secret access key |
| `BACKUP_S3_ENDPOINT` | ❌ | ❌ | — | Custom S3-compatible endpoint (e.g. MinIO) |
| `BACKUP_STORAGE_QUOTA_BYTES` | ❌ | ❌ | `10737418240` | Alert threshold: 10 GB |
| `BACKUP_ALERT_THRESHOLD_PERCENT` | ❌ | ❌ | `80` | Alert when quota usage exceeds this % |

### IPFS / Pinata

| Variable | Required | Secret | Default | Purpose |
|---|---|---|---|---|
| `IPFS_PROVIDER` | ❌ | ❌ | `pinata` | `pinata` or `local` |
| `PINATA_API_KEY` | ✅ (if Pinata) | ✅ | — | Pinata API key |
| `PINATA_SECRET_API_KEY` | ✅ (if Pinata) | ✅ | — | Pinata secret key |
| `PINATA_JWT` | ✅ (if Pinata) | ✅ | — | Pinata JWT (alternative to key+secret) |
| `IPFS_GATEWAY_URL` | ❌ | ❌ | `https://gateway.pinata.cloud/ipfs/` | Gateway for serving CIDs |
| `IPFS_LOCAL_NODE_URL` | ❌ | ❌ | `http://localhost:5001` | Local IPFS daemon (when provider=local) |
| `IPFS_MAX_RETRIES` | ❌ | ❌ | `1` | Upload retry count |

### Health Check / Monitoring

| Variable | Required | Secret | Default | Purpose |
|---|---|---|---|---|
| `HEALTH_CHECK_TIMEOUT_MS` | ❌ | ❌ | `5000` | Per-probe timeout |
| `REQUEST_LOG_SLOW_THRESHOLD_MS` | ❌ | ❌ | `5000` | Slow request warning threshold |

---

## Frontend (`apps/frontend`)

| Variable | Required | Secret | Default | Purpose |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | ✅ | ❌ | `""` (must be set) | Backend API base URL (no trailing slash). **Must match** the backend's `PORT`/`API_BASE_URL`. |
| `NEXT_PUBLIC_API_URL` | ❌ | ❌ | `http://localhost:3000` | Used for evidence upload path in `escrow-api.ts`. Should consolidate with `NEXT_PUBLIC_API_BASE_URL`. |
| `NEXT_PUBLIC_STELLAR_NETWORK` | ❌ | ❌ | `testnet` | Stellar network for display/links |
| `NEXT_PUBLIC_CONTRACT_ID` | ❌ | ❌ | — | Deployed contract ID (if not fetched from API) |
| `NEXT_PUBLIC_RPC_URL` | ❌ | ❌ | — | Stellar RPC endpoint override |

---

## Mobile (`apps/mobile`)

| Variable | Required | Secret | Default | Purpose |
|---|---|---|---|---|
| `EXPO_PUBLIC_APP_ENV` | ❌ | ❌ | `dev` | `dev`, `testnet`, or `production`. Selects the config block in `security/env.ts`. |
| `EXPO_PUBLIC_API_URL` | ✅ | ❌ | per-env default | Backend API URL (single source of truth). Read via `envConfig.apiUrl`. Dev default: `http://localhost:3000`, testnet: `https://api-testnet.vaultix.com`, production: `https://api.vaultix.com`. |
| `EXPO_PUBLIC_RPC_URL` | ✅ | ❌ | per-env default | Stellar Soroban RPC endpoint. Dev default: `http://localhost:8000/soroban/rpc`, testnet: `https://soroban-testnet.stellar.org`, production: `https://rpc.vaultix.com`. |
| `EXPO_PUBLIC_AUTH_PATH_PREFIX` | ❌ | ❌ | `/v1/auth` | Auth route prefix (override for custom gateways) |

---

## On-Chain Deployment (`apps/onchain`)

These values are passed to `stellar contract deploy` and invocation scripts.

| Variable | Required | Secret | Purpose |
|---|---|---|---|
| `STELLAR_NETWORK` | ✅ | ❌ | `testnet` or `mainnet` |
| `STELLAR_ACCOUNT_SECRET` | ✅ | ✅ | Deployer account secret key |
| `ADMIN_ADDRESS` | ✅ | ❌ | Initial admin address for `__constructor` |
| `OPERATOR_ADDRESS` | ✅ | ❌ | Initial operator address |
| `ARBITRATOR_ADDRESS` | ✅ | ❌ | Initial arbitrator address |
| `TREASURY_ADDRESS` | ✅ | ❌ | Fee collection address |
| `FEE_BPS` | ❌ | ❌ | Initial fee in basis points (default: 0) |

---

## Safe to commit in `.env.example`

The following are safe to include in example files (non-secret, no real credentials):
- All `*_PATH`, `*_DIR`, `*_TIMEOUT`, `*_RETRIES`, `*_DELAY` values
- `NODE_ENV`, `PORT`, `STELLAR_NETWORK`, `EXPO_PUBLIC_APP_ENV`
- `APP_MIN_SUPPORTED_VERSION`, `APP_LATEST_VERSION`
- All threshold/quota values

**Never commit:**
- `JWT_SECRET`, `WALLET_SECRET`, `SMTP_PASS`, `SMTP_USER`
- `PINATA_*`, `BACKUP_ENCRYPTION_KEY`
- `BACKUP_S3_ACCESS_KEY`, `BACKUP_S3_SECRET_KEY`
- `STELLAR_ACCOUNT_SECRET`
