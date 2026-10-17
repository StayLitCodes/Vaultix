# Vaultix

**QuickEx by Vaultix** - A modern, blockchain-powered escrow platform designed to safeguard online transactions by securely holding funds until all conditions are fulfilled. Built on the Stellar blockchain, QuickEx automates fund locking, milestone verification, and releases via smart contracts, minimising disputes and ensuring transparency for every step.

## 🚀 What is QuickEx?

### The Problem
Online peer-to-peer transactions carry inherent risks: buyers fear non-delivery, sellers worry about non-payment, and traditional payment methods offer limited protection for custom agreements. Existing escrow services are often expensive, slow, and lack transparency.

### The QuickEx Solution
QuickEx leverages Stellar blockchain technology to provide:
- **Trustless Transactions**: Smart contracts hold funds on-chain until milestones are met
- **Instant Settlement**: Blockchain-powered transactions settle in seconds
- **Transparent Tracking**: Real-time dashboards show escrow progress to all parties
- **Low Fees**: Minimal transaction costs compared to traditional escrow services
- **Global Access**: Borderless support for cross-border trades in XLM or custom Stellar assets

### Where QuickEx Fits in the Stellar Ecosystem
QuickEx is a Soroban-based dApp built on Stellar, utilizing:
- **Stellar Blockchain**: For fast, low-cost token transfers
- **Soroban Smart Contracts**: For on-chain escrow logic (Rust-based)
- **Stellar SDK**: For transaction building and submission
- **Freighter Wallet**: For user wallet interactions

## 🎯 MVP Scope (8-Week Timeline)

### ✅ In Scope for MVP
- **Core Escrow Flow**: Create, fund, verify milestones, and release funds
- **User Authentication**: JWT-based auth with secure wallet connection
- **Basic Dashboard**: View escrows by status (pending, active, completed, disputed)
- **Milestone Tracking**: Simple checkbox-based milestone completion
- **Dispute Resolution**: Admin-mediated dispute workflow
- **Single Asset Support**: XLM (Stellar Lumens) only
- **Web Notifications**: In-app notifications for escrow events
- **Admin Panel**: Basic oversight tools for dispute resolution
- **Testnet Deployment**: Fully functional on Stellar testnet

### ❌ Non-Goals (Post-MVP)
- Multi-asset support (custom tokens, USDC, etc.)
- Mobile applications (iOS/Android)
- Advanced analytics and reporting
- Automated market maker (AMM) integration
- Cross-chain bridges
- Fiat on/off ramps
- Advanced dispute mechanisms (arbitration markets)
- Gas optimization features
- White-label solutions

## 📚 Documentation

- **[Development Guide](DEVELOPMENT.md)** - Detailed setup instructions, troubleshooting, and workflows
- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute, branch naming, PR expectations
- **[Environment Variables](docs/ENVIRONMENT.md)** - Every env var across the monorepo, with secrets guidance
- **[Status Mapping](docs/STATUS_MAPPING.md)** - Cross-layer escrow/milestone status table and known gaps
- **[Contract Docs](docs/contract/README.md)** - Smart contract overview and deployment
- **[Contract Events](docs/contract/EVENTS.md)** - Event schema reference for indexers and consumers
- **[Mobile Security](docs/mobile-security.md)** - Environment setup, secure storage, and testnet switching
- **[Mobile Notifications](docs/mobile-notifications.md)** - Push notification strategy and MVP notes
- **[Notification Preferences and Digest](docs/notification-preferences.md)** - Per-channel preferences and daily email digest
- **[Dispute Flow](docs/dispute-flow.md)** - Dispute resolution process and UX
- **[API Reference](http://localhost:3000/api/docs)** - Backend API documentation (after running backend)

## Tech Stack
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS.
- **Backend**: Node.js / NestJS, PostgreSQL, Prisma ORM.
- **Blockchain**: Stellar Blockchain, Stellar SDK (JS) for escrow and settlements.
- **Authentication**: JWT / OAuth.
- **Payments**: Stellar Lumens (XLM) or custom assets.
- **Monorepo**: independent apps under `apps/`, each with its own npm scripts (see [Package manager](#package-manager)).

## Repository Structure
Vaultix is structured as a monorepo to streamline development across frontend, backend, and shared libraries. This setup enables independent service scaling while reusing components like auth helpers and Stellar utils.

```
vaultix/
├── apps/
│   ├── frontend/          # Next.js app (UI, dashboards)
│   └── backend/           # NestJS API (escrow logic, DB ops)
├── packages/
│   ├── ui/                # Shared components (Tailwind/ShadCN)
│   └── stellar-sdk/       # Stellar wrappers (transactions, queries)
├── prisma/                # Database schema/migrations (shared)
├── package.json           # Root tooling: ESLint, Prettier and husky hooks
├── turbo.json             # Build/dev pipelines
└── .env.example           # Root env template
```

For workflows, see [DEVELOPMENT.md](DEVELOPMENT.md). API docs in [API.md](API.md).

## 🛠️ Local Development

Get QuickEx running locally in minutes. This setup covers all three apps: frontend, backend, and onchain smart contract.

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 20+ ([Download](https://nodejs.org)) - JavaScript runtime
- **npm** 10+ (bundled with Node.js 20+) - Package manager (see [Package manager](#package-manager))
- **PostgreSQL** 14+ ([Download](https://www.postgresql.org)) OR **SQLite** (for simpler setup)
- **Rust** latest stable ([Download](https://rustup.rs)) - For Soroban smart contracts
- **Soroban CLI** (`cargo install --locked soroban-cli`) - For contract deployment
- **Git** - Version control
- **Stellar Wallet** - Freighter or Lobster wallet browser extension ([Install Freighter](https://freighter.app))

**Optional:**
- **Docker** - For containerized PostgreSQL
- **VS Code** with Rust Analyzer, ESLint, Prettier extensions

### Package manager

Vaultix uses **npm** as its single package manager (Node.js 20+ bundles a
compatible version). Every app keeps its own `package-lock.json`; no other
lockfiles are committed and CI fails if a `pnpm-lock.yaml`, `pnpm-workspace.yaml`
or `yarn.lock` is added (see
[CONTRIBUTING.md](CONTRIBUTING.md#package-manager) for the rationale).

```bash
npm install                        # root tooling (+ git hooks)
npm --prefix apps/backend install
npm --prefix apps/frontend install
```

### Pre-commit hooks

Lint and format checks run automatically before each commit, via
[husky](https://typicode.github.io/husky/). Hooks are installed by the root
`prepare` script when you run `npm install`; to (re)install them manually:

```bash
./scripts/setup-hooks.sh
```

Only the files being committed are checked:

| Staged files | Check |
| --- | --- |
| `*.ts`, `*.tsx`, `*.js`, `*.json`, `*.md`, `*.css` | `prettier --check` |
| `*.ts`, `*.tsx`, `*.js` under `apps/backend` / `apps/frontend` | that app's `eslint` |
| `*.rs` | `rustfmt --check` |
| `*.sh`, `*.bash` | `shellcheck` |

Checks whose tool is not installed are skipped with a warning (install
`shellcheck` for shell checks; `rustfmt` ships with Rust).

To bypass a run:

```bash
SKIP_HOOKS=1 git commit -m "wip"   # skip only these checks
git commit --no-verify             # skip all git hooks
```

Please keep `--no-verify` for emergencies only - CI runs the same checks.

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/vaultix.git
   cd vaultix
   ```

2. **Install dependencies**. From the repository root (this also installs the
   root tooling and the husky git hooks):
   ```bash
   npm install
   ```

   Each app is an independent package with its own dependencies:
   ```bash
   npm --prefix apps/backend install
   npm --prefix apps/frontend install
   npm --prefix apps/mobile install   # optional (React Native app)
   ```

3. **Set up environment variables**:
   
   **Backend** (`apps/backend/.env`):
   ```bash
   cp apps/backend/.env.example apps/backend/.env
   ```
   
   Edit `apps/backend/.env` with your configuration:
   ```env
   # Database Configuration
   DATABASE_PATH=./data/vaultix.db  # SQLite path (or use DATABASE_URL for PostgreSQL)
   
   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key-change-in-production
   JWT_EXPIRES_IN=15m
   
   # Environment
   NODE_ENV=development
   
   # Server Configuration
   PORT=3000
   
   # Stellar Configuration
   STELLAR_NETWORK=testnet  # Use 'futurenet' for Soroban
   WALLET_SECRET=your-stellar-wallet-secret  # For dev transactions
   STELLAR_TIMEOUT=60000
   STELLAR_MAX_RETRIES=3
   STELLAR_RETRY_DELAY=1000
   
   # Email (SMTP) Configuration - Optional for local dev
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_USER=your-smtp-user
   SMTP_PASS=your-smtp-password
   EMAIL_FROM=no-reply@vaultix.io
   ```
   
   **Frontend** (`apps/frontend/.env.local`):
   ```bash
   cp apps/frontend/.env.example apps/frontend/.env.local
   ```
   
   Create `apps/frontend/.env.local`:
   ```env
   NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
   NEXT_PUBLIC_STELLAR_NETWORK=testnet
   ```

4. **Set up database**:
   ```bash
   cd apps/backend
   npm run typeorm -- migration:run
   npm run seed:admin  # Create initial admin user
   ```

### Running Locally

**Run the services (Recommended)**

The backend and the frontend are separate apps and are started in separate
terminals:

```bash
# Terminal 1 - Backend
cd apps/backend
npm run start:dev

# Terminal 2 - Frontend
cd apps/frontend
npm run dev

# Terminal 3 - Watch onchain contracts (optional)
cd apps/onchain
cargo build --target wasm32v1-none --release
```

### Testing Your Setup

1. **Open frontend**: Navigate to http://localhost:3001
2. **Connect wallet**: Click "Connect Wallet" and approve Freighter connection
3. **Create test escrow**: Go to Create Escrow page and set up a mock transaction
4. **Check backend**: Visit http://localhost:3000/api/docs to explore API endpoints

### Common Troubleshooting

**Port already in use**:
```bash
# Kill process on port 3000 (Windows PowerShell)
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**Database connection errors**:
- Ensure PostgreSQL is running: `pg_ctl status` or check Docker container
- Verify `DATABASE_URL` or `DATABASE_PATH` in `.env`
- Run migrations: `cd apps/backend && npm run typeorm -- migration:run`

**TypeScript/Linting errors**:
```bash
# From the app directory (e.g. apps/backend)
cd apps/backend && npm run lint
cd apps/frontend && npm run lint
```

**Wallet connection issues**:
- Make sure Freighter/Lobster extension is installed
- Switch wallet to **Testnet** network
- Ensure you have test XLM (get from [Stellar Laboratory](https://laboratory.stellar.org))

**Build errors**:
```bash
# Clean and reinstall
cd apps/backend
rm -rf node_modules dist
npm install

# Same for frontend
cd apps/frontend
rm -rf node_modules .next
npm install
```

**Onchain/Rust errors**:
```bash
# Update Rust toolchain
rustup update
rustup target add wasm32v1-none

# Rebuild contract
cd apps/onchain
cargo clean
cargo build --target wasm32v1-none --release
```

### Environment Setup
1. Set up PostgreSQL: Create `vaultix_db` and run migrations:
   ```
   npx prisma migrate dev --name init
   ```
2. Copy `.env.example` to `.env` and configure:
   ```
   DATABASE_URL="postgresql://username:password@localhost:5432/vaultix_db"
   JWT_SECRET="your-super-secret-jwt-key"
   STELLAR_NETWORK="testnet"  # "mainnet" for production
   WALLET_SECRET="your-stellar-wallet-secret"  # For dev txs
   ```
3. Stellar network: Fund testnet wallet at [laboratory.stellar.org](https://laboratory.stellar.org). For mainnet, use real assets.

### Running Locally
1. Start the apps (in separate terminals):
   ```
   npm --prefix apps/backend run start:dev
   npm --prefix apps/frontend run dev
   ```
   - Frontend: [http://localhost:3000](http://localhost:3000).
   - Backend: [http://localhost:9000](http://localhost:9000).
2. Test escrow: Connect wallet, initiate a mock transaction.

### Testing
1. Lint (per app):
   ```
   npm --prefix apps/backend run lint
   npm --prefix apps/frontend run lint
   ```
2. Unit/integration (per app):
   ```
   npm --prefix apps/backend test
   npm --prefix apps/frontend test
   ```
   (Jest for JS/TS, Prisma mocks for DB.)
3. E2E:
   ```
   npm --prefix apps/frontend run test:e2e
   ```
   (Playwright; requires testnet.)

### Deployment
- **Frontend/Backend**: Vercel (frontend), Render/AWS (backend)—link GitHub, add env vars.
- **Database**: Supabase or managed PostgreSQL.
- **Production**: Set `STELLAR_NETWORK=mainnet`; CI/CD via GitHub Actions.

## Usage
### How It Works
1. **Initiate**: Buyer locks XLM via Stellar tx.
2. **Verify**: Seller completes milestones; buyer approves.
3. **Release**: Auto-payout on confirmation or dispute resolution.

### User Roles
- **Buyer**: Funds escrow, confirms delivery.
- **Seller**: Tracks progress, claims funds.
- **Admin**: Oversees, arbitrates.

### Admin Capabilities
- Transaction views/filters.
- Account freezes.
- Dispute mediation.
- Analytics reports.

## Security Measures
- On-chain Stellar verification.
- Escrow via SDK/smart contracts.
- Multi-sig for high-value.
- Encrypted APIs, 2FA, audit logs.

## 🏗️ Architecture Overview

### Repository Structure

QuickEx is organized as a monorepo with three main applications:

```
vaultix/
├── apps/
│   ├── frontend/          # Next.js 15 app - User interface & dashboards
│   │   ├── app/           # App router pages
│   │   ├── components/    # React components (ShadCN UI)
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utilities & API clients
│   │   ├── services/      # Business logic services
│   │   └── types/         # TypeScript type definitions
│   │
│   ├── backend/           # NestJS API - Business logic & data layer
│   │   ├── src/
│   │   │   ├── modules/   # Feature modules (auth, escrow, stellar, etc.)
│   │   │   ├── entities/  # TypeORM database entities
│   │   │   ├── guards/    # Auth & authorization guards
│   │   │   └── migrations/# Database schema migrations
│   │   └── test/          # E2E tests
│   │
│   └── onchain/           # Soroban smart contracts (Rust)
│       ├── src/
│       │   ├── lib.rs     # Contract entry point
│       │   ├── types.rs   # Contract data types
│       │   └── test.rs    # Contract tests
│       └── Cargo.toml     # Rust dependencies
│
├── docs/                  # Documentation
│   └── contract/          # Smart contract documentation
│
└── package.json           # Root tooling: ESLint, Prettier and husky hooks
```

### Key Entry Points

- **Frontend**: `apps/frontend/app/page.tsx` - Landing page
- **Backend**: `apps/backend/src/main.ts` - NestJS bootstrap
- **Onchain**: `apps/onchain/src/lib.rs` - Soroban contract entry

### Key User Flows

#### 1. Authentication & Wallet Connect
1. User visits frontend and clicks "Connect Wallet"
2. Freighter wallet popup requests connection approval
3. Frontend calls backend `/auth/wallet-connect` with public key
4. Backend creates/updates user, returns JWT token
5. Frontend stores JWT in localStorage, attaches to subsequent requests

#### 2. Create Escrow Flow
1. User navigates to `/escrow/create`
2. Fills form: recipient, amount, milestones, deadline
3. Frontend calls POST `/api/escrows` with escrow details
4. Backend creates escrow record, returns escrow ID
5. User approves Stellar transaction via Freighter
6. Frontend submits transaction to Stellar network
7. Backend webhook receives event, updates escrow status to "funded"

#### 3. Milestone Completion Flow
1. Seller marks milestone as complete in dashboard
2. Frontend calls PATCH `/api/escrows/:id/milestones/:milestoneId`
3. Backend updates milestone status, notifies buyer
4. Buyer reviews and approves: PATCH `/api/escrows/:id/approve`
5. Smart contract releases funds to recipient
6. Both parties receive confirmation notifications

#### 4. Dispute Resolution Flow
1. Either party raises dispute: POST `/api/escrows/:id/dispute`
2. Escrow pauses, admin notified
3. Admin reviews evidence in admin panel
4. Admin decides fund distribution: POST `/api/admin/escrows/:id/resolve`
5. Contract executes distribution, escrow closes

### Data Flow Diagram

```
Frontend (Next.js)
    ↓ HTTP/REST
Backend (NestJS)
    ↓ TypeORM
Database (PostgreSQL/SQLite)
    ↓ Stellar SDK
Stellar Network
    ↔ Soroban Contract (onchain/)
```

## 🔍 Dependency Audit & Health Checks

Two helper scripts cover routine maintenance and post-deploy verification. Both
are POSIX/bash scripts that pass `shellcheck` and work on Linux and macOS
(run them under WSL or Git Bash on Windows).

### Dependency audit

`scripts/audit.sh` runs `npm audit` for the JavaScript apps and `cargo audit`
for the Soroban contract. It **fails on HIGH/CRITICAL** advisories and merely
warns for lower severities, writing JSON reports to `audit-reports/`.

```bash
# Audit everything (JS + Rust)
./scripts/audit.sh

# Audit only one ecosystem
./scripts/audit.sh --js
./scripts/audit.sh --rust

# Choose where the JSON reports are written
./scripts/audit.sh --report-dir /tmp/audit
```

The `Dependency Audit` workflow (`.github/workflows/dependency-audit.yml`) runs
the same script weekly (Mondays 06:17 UTC), on demand, and whenever a lockfile
changes, uploading `audit-reports/` as a build artifact. **Prerequisites:**
Node.js 20+ and, for the Rust audit, `cargo install cargo-audit` (CI installs it
automatically). Dependabot is configured in `.github/dependabot.yml` for npm,
cargo and GitHub Actions.

### API smoke test

`scripts/smoke-test.sh` waits for the API to become healthy and then checks a
handful of read-only and auth endpoints, reporting status codes and latency and
exiting non-zero on any failure. Use it for staging/production verification:

```bash
# Local API on the default port
./scripts/smoke-test.sh

# A deployed environment, with more retries for a cold start
./scripts/smoke-test.sh https://api.staging.example --retries 30 --delay 2
```

Options include `--url`, `--timeout`, `--retries`, `--delay`, `--max-latency`
and `--skip-readiness` (see `./scripts/smoke-test.sh --help`). The `API Smoke
Test` workflow boots the API with SQLite and runs the script on backend changes,
and can also be dispatched manually against any `base_url`. **Prerequisites:**
`curl`.

## 🤝 Contributing
Contributions welcome to bolster Vaultix's trust features!
- **Issues**: Report bugs with repro/env details.
- **Features**: Discuss in GitHub Discussions.
- **PRs**:
  1. Branch: `git checkout -b feat/your-feature`.
  2. Code/test/lint.
  3. Commit: "feat: add milestone notifications".
  4. PR to `main`.
- Run a script for a single app: `npm --prefix apps/backend run build`.
- **Mobile app**: see [apps/mobile/README.md](apps/mobile/README.md) for Expo SDK 52 / React Native 0.76 prerequisites, `EXPO_PUBLIC_*` environment variables (matching `security/env.ts`), and `start`, `android`, `ios`, `lint`, `type-check`, and `test` commands.
Follow [CONTRIBUTING.md](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

## License
MIT. See [LICENSE](LICENSE).

## Vision
Pioneering secure DeFi escrow on Stellar for African and global markets. 🚀

Built with ❤️. Join [Discord](https://discord.gg/vaultix) or issue for support.
