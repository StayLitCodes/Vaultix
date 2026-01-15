# Vaultix

Vaultix is a modern, blockchain-powered escrow platform designed to safeguard online transactions by securely holding funds until all conditions are fulfilled. Built on the Stellar blockchain, it automates fund locking, milestone verification, and releases via smart contracts, minimising disputes and ensuring transparency for every step. With real-time updates and robust security, Vaultix transforms peer-to-peer trades into reliable, trustless experiences—eliminating the risks of traditional payment methods.

Tailored for buyers and sellers in emerging markets like Africa, Vaultix supports freelancers, e-commerce merchants, and small businesses handling cross-border deals in XLM or custom Stellar assets. Whether you're a creator delivering digital services or a buyer acquiring goods, the platform promotes fairness, low fees, and instant settlements, fostering economic inclusion through decentralised finance.

## Features
### Core
- **Secure Fund Holding**: Locks payments on-chain until milestones are met.
- **Buyer & Seller Protection**: Automated safeguards against non-delivery or non-payment.
- **Transaction Milestone Tracking**: Real-time progress monitoring with notifications.
- **Automated Fund Release**: Stellar-based smart contracts trigger payouts on confirmation.

### Advanced
- **Dispute Resolution**: Structured mediation with admin oversight.
- **User Authentication**: JWT/OAuth for secure access.
- **Real-Time Status Updates**: Live dashboards for all parties.
- **Admin Monitoring**: Centralised tools for oversight and analytics.

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

## Setup Instructions

### Prerequisites
- Node.js 18+ ([nodejs.org](https://nodejs.org)).
- pnpm (install: `npm install -g pnpm`).
- PostgreSQL 14+ ([postgresql.org](https://www.postgresql.org)).
- Stellar testnet wallet (Freighter/Lobster; [freighter.app](https://freighter.app)).
- Git (for cloning).
- Docker (optional, for DB; [docker.com](https://docker.com)).

### Installation
1. Clone the repository:
   ```
   git clone https://github.com/yourusername/vaultix.git
   cd vaultix
   ```

2. Install dependencies:
   ```
   pnpm install
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

## Contributing
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
