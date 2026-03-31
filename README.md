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
- **[Contract Docs](docs/contract/README.md)** - Smart contract overview and deployment
- **[API Reference](http://localhost:3000/api/docs)** - Backend API documentation (after running backend)

## Tech Stack
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS.
- **Backend**: Node.js / NestJS, PostgreSQL, Prisma ORM.
- **Blockchain**: Stellar Blockchain, Stellar SDK (JS) for escrow and settlements.
- **Authentication**: JWT / OAuth.
- **Payments**: Stellar Lumens (XLM) or custom assets.
- **Monorepo**: pnpm workspaces with TurboRepo for shared utilities and efficient builds.

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
├── .pnpm-workspace.yaml   # pnpm config for workspaces
├── turbo.json             # Build/dev pipelines
└── .env.example           # Root env template
```

For workflows, see [DEVELOPMENT.md](DEVELOPMENT.md). API docs in [API.md](API.md).

## 🛠️ Local Development

Get QuickEx running locally in minutes. This setup covers all three apps: frontend, backend, and onchain smart contract.

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18+ ([Download](https://nodejs.org)) - JavaScript runtime
- **pnpm** 8+ (`npm install -g pnpm`) - Package manager (required for monorepo)
- **PostgreSQL** 14+ ([Download](https://www.postgresql.org)) OR **SQLite** (for simpler setup)
- **Rust** latest stable ([Download](https://rustup.rs)) - For Soroban smart contracts
- **Soroban CLI** (`cargo install --locked soroban-cli`) - For contract deployment
- **Git** - Version control
- **Stellar Wallet** - Freighter or Lobster wallet browser extension ([Install Freighter](https://freighter.app))

**Optional:**
- **Docker** - For containerized PostgreSQL
- **VS Code** with Rust Analyzer, ESLint, Prettier extensions

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/vaultix.git
   cd vaultix
   ```

2. **Install dependencies** (from root):
   ```bash
   pnpm install
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
   pnpm typeorm migration:run
   pnpm seed:admin  # Create initial admin user
   ```

### Running Locally

**Option 1: Run everything together (Recommended)**

From the root directory:
```bash
pnpm turbo run dev
```

This starts:
- **Backend**: http://localhost:3000
- **Frontend**: http://localhost:3001 (or 3000, check output)
- API Docs: http://localhost:3000/api/docs

**Option 2: Run services separately**

In separate terminals:

```bash
# Terminal 1 - Backend
cd apps/backend
pnpm start:dev

# Terminal 2 - Frontend
cd apps/frontend
pnpm dev

# Terminal 3 - Watch onchain contracts (optional)
cd apps/onchain
cargo build --target wasm32-unknown-unknown --release
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
- Run migrations: `cd apps/backend && pnpm typeorm migration:run`

**TypeScript/Linting errors**:
```bash
# From root
pnpm turbo run lint
pnpm turbo run type-check  # If configured
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
pnpm install

# Same for frontend
cd apps/frontend
rm -rf node_modules .next
pnpm install
```

**Onchain/Rust errors**:
```bash
# Update Rust toolchain
rustup update
rustup target add wasm32-unknown-unknown

# Rebuild contract
cd apps/onchain
cargo clean
cargo build --target wasm32-unknown-unknown --release
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
1. Launch with TurboRepo:
   ```
   pnpm turbo run dev
   ```
   - Frontend: [http://localhost:3000](http://localhost:3000).
   - Backend: [http://localhost:9000](http://localhost:9000).
2. Test escrow: Connect wallet, initiate a mock transaction.

### Testing
1. Lint/type-check:
   ```
   pnpm turbo run lint
   pnpm turbo run type-check
   ```
2. Unit/integration:
   ```
   pnpm turbo run test
   ```
   (Jest for JS/TS, Prisma mocks for DB.)
3. E2E:
   ```
   pnpm turbo run test:e2e
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
├── package.json           # Root package.json (shared configs)
└── pnpm-workspace.yaml    # pnpm workspace configuration
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

## 🤝 Contributing
Contributions welcome to bolster Vaultix's trust features!
- **Issues**: Report bugs with repro/env details.
- **Features**: Discuss in GitHub Discussions.
- **PRs**:
  1. Branch: `git checkout -b feat/your-feature`.
  2. Code/test/lint.
  3. Commit: "feat: add milestone notifications".
  4. PR to `main`.
- Monorepo tips: `pnpm turbo run build --filter=...`.
Follow [CONTRIBUTING.md](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

## License
MIT. See [LICENSE](LICENSE).

## Vision
Pioneering secure DeFi escrow on Stellar for African and global markets. 🚀

Built with ❤️. Join [Discord](https://discord.gg/vaultix) or issue for support.
