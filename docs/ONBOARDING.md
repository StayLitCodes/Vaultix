# Contributor Onboarding: Local Environment & Stellar Testnet Setup

> **Goal**: Go from `git clone` to a running local dev environment in under 15 minutes.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [1. Fork & Clone](#1-fork--clone)
- [2. Install the Rust Toolchain](#2-install-the-rust-toolchain)
- [3. Install Soroban CLI](#3-install-soroban-cli)
- [4. Configure Stellar Testnet](#4-configure-stellar-testnet)
- [5. Fund Your Testnet Account via Friendbot](#5-fund-your-testnet-account-via-friendbot)
- [6. Set Up Environment Variables](#6-set-up-environment-variables)
- [7. Run the Full Stack Locally](#7-run-the-full-stack-locally)
- [8. Run Contract Tests](#8-run-contract-tests)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | https://nodejs.org |
| pnpm | 8+ | `npm install -g pnpm` |
| Rust | latest stable | https://rustup.rs |
| Git | any | https://git-scm.com |
| PostgreSQL | 14+ | https://www.postgresql.org OR use SQLite |

---

## 1. Fork & Clone

```bash
git clone https://github.com/YOUR_USERNAME/Vaultix.git
cd Vaultix
pnpm install
```

---

## 2. Install the Rust Toolchain

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustup target add wasm32-unknown-unknown
rustc --version && cargo --version
```

---

## 3. Install Soroban CLI

```bash
cargo install --locked soroban-cli
soroban --version
```

> **Note**: Run this from outside the `apps/onchain` directory.

---

## 4. Configure Stellar Testnet

```bash
soroban network add \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015" \
  testnet

soroban network ls
```

---

## 5. Fund Your Testnet Account via Friendbot

```bash
soroban keys generate --no-fund dev-account
curl "https://friendbot.stellar.org?addr=$(soroban keys address dev-account)"
soroban keys fund dev-account --network testnet
```

Manual funding: https://laboratory.stellar.org/#account-creator?network=test

---

## 6. Set Up Environment Variables

```bash
cp apps/backend/.env.example apps/backend/.env
touch apps/frontend/.env.local
```

`apps/backend/.env`:
```env
DATABASE_PATH=./data/vaultix.db
JWT_SECRET=any-long-random-string-here
JWT_EXPIRES_IN=15m
NODE_ENV=development
PORT=3000
STELLAR_NETWORK=testnet
WALLET_SECRET=S...YOUR_SECRET_KEY...
STELLAR_TIMEOUT=60000
STELLAR_MAX_RETRIES=3
STELLAR_RETRY_DELAY=1000
ESCROW_CONTRACT_ID=
```

`apps/frontend/.env.local`:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
NEXT_PUBLIC_STELLAR_NETWORK=testnet
```

---

## 7. Run the Full Stack Locally

```bash
# All at once (recommended)
pnpm turbo run dev
# Backend → http://localhost:3000
# Frontend → http://localhost:3001
# API Docs → http://localhost:3000/api/docs
```

Or separately:
```bash
# Terminal 1
cd apps/backend && pnpm start:dev
# Terminal 2
cd apps/frontend && pnpm dev
```

---

## 8. Run Contract Tests

```bash
cd apps/onchain
cargo build --target wasm32-unknown-unknown --release
cargo test

# Optional: deploy to testnet
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/vaultix_escrow.wasm \
  --source dev-account \
  --network testnet
```

Copy the output contract ID into `ESCROW_CONTRACT_ID` in your `.env`.

---

## Troubleshooting

### `soroban: command not found`
```bash
export PATH="$HOME/.cargo/bin:$PATH"
# Add to ~/.bashrc or ~/.zshrc to persist
```

### Soroban RPC connection errors
- RPC URL: `https://soroban-testnet.stellar.org`
- Passphrase must be exactly: `Test SDF Network ; September 2015`
- Check config: `soroban network ls`

### Friendbot returns 400
Account already funded — you're fine, keep going.

### `wasm32-unknown-unknown` target missing
```bash
rustup target add wasm32-unknown-unknown
```

### Backend database errors
```bash
mkdir -p apps/backend/data
cd apps/backend && pnpm typeorm migration:run
```

### Port already in use
```bash
lsof -ti:3000 | xargs kill -9
```

### Rust build errors
```bash
rustup update stable && cargo clean
cargo build --target wasm32-unknown-unknown --release
```

---

## You're all set! 🚀

1. Open http://localhost:3001
2. Install [Freighter wallet](https://freighter.app)
3. Switch Freighter to **Testnet**
4. Connect wallet and create a test escrow

Questions? Join [Discord](https://discord.gg/vaultix) or open a GitHub Discussion.
