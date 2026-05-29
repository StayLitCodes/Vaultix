# Vaultix (QuickEx by Vaultix)

This repository is a monorepo containing the **frontend dApp**, the **NestJS backend**, and the **on-chain escrow smart contract** (Soroban / Rust). The project is branded as **QuickEx by Vaultix**.

---

## How to read this README

This document is intentionally written as an end-to-end “tour” of the system:

1. Big-picture architecture and repository layout
2. Domain model (escrows, parties, conditions, disputes)
3. Backend orchestration (what the NestJS service does)
4. Scheduling and default dispute resolution (cron-driven logic)
5. On-chain contract responsibilities (what the Rust code enforces)
6. Frontend responsibilities (how the user interacts with the system)
7. Operational concerns: testing, deployment, and eventing

Because this is a live codebase, always treat the README as the conceptual contract of behavior. If you modify backend entity fields or contract interfaces, the documentation should be updated accordingly.

---

## 1) Executive summary

QuickEx by Vaultix is a blockchain-powered escrow platform that aims to reduce the friction and trust problems common in traditional escrow.

In a typical online exchange:

- The buyer wants assurance the seller will deliver.
- The seller wants assurance the buyer will pay.
- Traditional escrows often introduce manual steps, fees, and limited transparency.

QuickEx moves the key “fund holding” and settlement semantics to the Stellar ecosystem:

- Funds are locked and released using Stellar transactions and (where applicable) Soroban smart contract logic.
- A backend orchestrates state transitions, milestone progression, dispute filing, and resolution.
- Real-time or near-real-time observability is supported through an event model and scheduled processing.

The result is a system where parties can track escrow progress, confirm milestone outcomes, and resolve disputes with deterministic fallback behavior when deadlines are exceeded.

---

## 2) Repository overview (monorepo)

The repository is structured around an `apps/` directory plus shared documentation under `docs/`.

### 2.1 apps/frontend

The frontend is implemented with **Next.js** (App Router) and **TypeScript**.

Key responsibilities:

- Provide UI screens for escrow creation, dashboard views, and admin/dispute views.
- Connect to the user’s Stellar wallet (Freighter or similar extension).
- Send authenticated requests to the backend.
- Display escrow progress, milestone states, and notifications.

The frontend code is organized into:

- `app/`: route entry points (pages/layout)
- `components/`: UI components grouped by feature
- `hooks/`: reusable hooks to manage data fetching and mutations
- `lib/`: shared utilities (API client, schema helpers)
- `services/`: thin API wrappers used by hooks
- `types/`: TypeScript domain types used throughout the UI

### 2.2 apps/backend

The backend is implemented with **NestJS** and **TypeORM**.

Key responsibilities:

- Maintain persistent state for users, escrows, parties, conditions, disputes, and event logs.
- Enforce business rules and role-based access control.
- Integrate with Stellar via specialized services.
- Dispatch webhook events for external integrations.
- Provide API endpoints consumed by the frontend.
- Run background tasks (cron) such as expiration warnings and default dispute resolution.

The backend code is organized into modules and services under `apps/backend/src/modules/`.

### 2.3 apps/onchain

The on-chain layer is implemented in **Rust** for **Soroban**.

Key responsibilities:

- Enforce escrow settlement semantics on-chain (locking/releasing funds, handling payout logic).
- Provide the on-chain interface required by backend Stellar integration services.
- Provide Rust unit tests and snapshot tests.

Contract-level documentation is present in `docs/contract/`.

---

## 3) Core domain model

At the heart of QuickEx is an **Escrow**.

An escrow in this system typically consists of:

1. **Parties**: users assigned roles (buyer/seller/arbitrator)
2. **Conditions**: the milestone-like requirements that must be fulfilled and confirmed
3. **Lifecycle status**: `pending`, `active`, `completed`, `cancelled`, `disputed`, `expired`
4. **Disputes**: if parties disagree, disputes can be filed and resolved
5. **Escrow events**: an append-only log of state transitions and actions

### 3.1 Escrow roles (Parties)

Roles determine who can do what:

- **Buyer**: funds the escrow and confirms conditions
- **Seller**: fulfills conditions (and may file disputes)
- **Arbitrator / Admin**: resolves disputes

The backend uses these roles to decide authorization and business rule applicability.

### 3.2 Conditions (milestones)

Conditions represent the milestone requirements.

In the lifecycle:

- A seller marks a condition as fulfilled (and attaches evidence/notes).
- The buyer confirms the condition (and the system auto-releases if all conditions are met).

Conditions carry additional fields for:

- fulfillment and confirmation timestamps
- fulfillment evidence (e.g., IPFS CID(s))
- notes and metadata

### 3.3 Disputes and outcomes

A dispute is filed against an escrow when agreement fails.

A dispute has:

- status (e.g., `OPEN`, `RESOLVED`)
- an outcome (e.g., refund, split)
- a `disputeDeadline` that gates fallback resolution

Default resolution means: if nobody resolves before the deadline, the system applies a deterministic fallback.

---

## 4) Backend orchestration (EscrowService)

The backend contains a central orchestration service (notably `apps/backend/src/modules/escrow/services/escrow.service.ts`).

Although the file is large, the responsibilities cluster into distinct functional areas.

### 4.1 Create escrow

When an escrow is created:

- Asset validation happens via `AllowedAsset` checks.
- Amount decimal precision is validated against allowed decimals.
- The creator’s Stellar wallet address is verified.
- The creator’s Stellar account is queried to ensure sufficient balance.
- For non-native assets, a trustline check is required.
- The recipient/seller trustline may also be checked.

Then the backend:

- creates an `Escrow` record
- creates party entries for the buyer/seller/arbitrator roles
- creates condition entries
- logs an `EscrowEventType.CREATED` event
- dispatches an external webhook event such as `escrow.created`

### 4.2 Listing and overview queries

The backend offers listing endpoints:

- overview listings optimized for UI dashboards
- full lists with filtering, sorting, and pagination

These queries may use TypeORM query builders to join parties and conditions and compute derived quantities such as total released vs remaining.

### 4.3 State transitions: update, cancel, expire

Rules typically include:

- Only specific roles can cancel/expire
- Only non-terminal statuses can be transitioned
- Transition validation uses helper functions such as `validateTransition` and `isTerminalStatus`

### 4.4 Funding and on-chain execution

Funding transitions an escrow from `pending` → `active`:

- Only the creator/buyer can fund.
- The escrow amount must match the expected amount.
- The backend calls an on-chain integration service to perform the Stellar transaction.
- Once the transaction is submitted (or confirmed depending on integration design), the backend updates escrow state fields such as:
  - `stellarTxHash`
  - `fundedAt`
  - `status = active`
- Events and webhooks are emitted.

### 4.5 Releasing escrow

When conditions are fully confirmed:

- backend auto-releases (for auto release scenario)
- backend validates escrow is active and not expired
- backend calls on-chain integration to complete settlement
- backend updates escrow state:
  - `status = completed`
  - `isReleased = true`
  - `releaseTransactionHash` (when available)
- events and webhooks are dispatched.

### 4.6 Disputes: file, evidence upload, resolve

When a dispute is filed:

- escrow must be active
- filing party must be authorized
- dispute record is created
- escrow transitions to `disputed`
- the backend sets a deadline (`disputeDeadline`) used by default resolution
- `DISPUTE_FILED` event is logged
- webhook `escrow.disputed` is dispatched

Evidence upload uses IPFS:

- backend uploads evidence bytes to IPFS
- stores returned CID(s) in the dispute evidence array
- returns gateway URL to the caller

Resolution is arbitrator-driven:

- arbitrator must be assigned to the escrow
- outcome-specific validation (e.g., split percentages sum to 100)
- backend attempts on-chain resolution when the required Stellar wallet addresses exist
- persists dispute resolution fields (outcome, sellerPercent/buyerPercent, resolvedByUserId, resolvedAt)
- transitions escrow to `completed` or `cancelled` depending on outcome
- logs `DISPUTE_RESOLVED` event and dispatches webhook.

---

## 5) Scheduled automation and default dispute resolution

A key “safety net” in escrow systems is: what happens if a dispute is never resolved?

QuickEx implements deadline-driven fallback resolution using NestJS cron jobs.

### 5.1 EscrowSchedulerService

File: `apps/backend/src/modules/escrow/services/escrow-scheduler.service.ts`

This service defines several cron methods:

1. **handleExpiredEscrows**
   - runs every hour
   - processes expired `pending` escrows and expired `active` escrows

2. **handleOverdueDisputes**
   - runs every 5 minutes
   - finds escrows in `disputed` status with `disputeDeadline` in the past
   - triggers default resolution via escrow service

3. **sendExpirationWarnings**
   - runs daily (9AM)
   - finds escrows nearing expiration and sends warnings

In the scheduler, when an automatic transition occurs, the backend also records `EscrowEvent` entries (like expiration warning sent) and may notify parties.

### 5.2 DisputeDefaultResolutionService

File: `apps/backend/src/modules/escrow/services/dispute-default-resolution.service.ts`

This service is responsible for:

- selecting fallback behavior (e.g., refund-to-buyer vs split) via environment variable `DISPUTE_DEFAULT_OUTCOME`
- scanning for candidate disputes where the deadline is exceeded
- invoking escrow service to apply the fallback

The design separates:

- “detect overdue disputes” (scheduler)
- “choose the fallback outcome” (default resolution service)

---

## 6) Entities and persistence model

The backend uses TypeORM entities.

A key entity for this task is:

- `apps/backend/src/modules/escrow/entities/escrow.entity.ts`

This entity defines:

- escrow core fields (title, description, amount, asset code/issuer)
- lifecycle fields (status, expiresAt, expirationNotifiedAt, isActive)
- dispute deadline field: `disputeDeadline`
- relations to:
  - parties
  - conditions
  - events
  - dispute

> Note: During the investigation for documentation, merge conflict markers were detected in escrow-related files. Those markers indicate the codebase may not currently be in a fully buildable/consistent state.

---

## 7) On-chain contract responsibilities (Soroban)

The on-chain code (Rust in `apps/onchain/`) complements the backend.

Contract responsibilities include:

- escrow entry points and state
- dispute resolution semantics
- payout logic for refund or split outcomes

The contract docs under `docs/contract/` describe workflows, data models, and errors.

From the backend’s perspective, the contract is used through an integration service:

- backend builds and submits transactions to the Stellar network
- backend records transaction hashes and updates DB state accordingly

In other words:

- the backend is the “orchestrator and indexer”
- the contract is the “enforcer”

---

## 8) Webhooks and notifications

QuickEx emits webhook events whenever escrow lifecycle changes.

It also supports an internal notifications subsystem:

- notification persistence
- preference handling
- email sender integration
- cron processing for pending notifications

This provides multi-channel user communication:

- on-screen dashboard updates
- email notifications (when configured)
- in-app toasts driven by event streams / polling

---

## 9) Security considerations

A secure escrow system needs defense-in-depth.

This repository uses multiple layers:

- Auth via JWT
- Role-based access control checks in service methods
- State transition validation (escrow state machine)
- Idempotency checks to prevent duplicate releases or operations
- On-chain settlement as the ultimate source of truth for fund movement

---

## 10) Frontend UX architecture

The frontend is responsible for:

- wallet connect
- authenticated API calls
- creating escrows and submitting milestones
- reacting to backend state changes

Common patterns:

- API calls are abstracted into `services/`.
- hooks in `hooks/` orchestrate fetching and calling those services.
- UI components in `components/` present status and actionable buttons.

---

## 11) Development, testing, and deployment

### 11.1 Local development

A typical local flow is:

- install dependencies (pnpm)
- configure environment variables for backend and frontend
- run backend with migrations and seed
- run frontend
- test on Stellar testnet

### 11.2 Testing

Testing spans:

- frontend Jest/Playwright
- backend Jest tests
- contract Rust tests

### 11.3 Deployment

Deployment typically includes:

- frontend to a web hosting platform (Vercel-like)
- backend to a Node server platform
- database to managed PostgreSQL

Stellar network configuration distinguishes testnet from mainnet.

---

## 12) Important note: merge conflicts detected

While preparing this README, merge conflict markers were observed inside escrow-related files, including:

- `apps/backend/src/modules/escrow/services/escrow.service.ts`
- `apps/backend/src/modules/escrow/entities/escrow.entity.ts`
- `TODO.md`

Unresolved merge conflict markers typically break TypeScript compilation and create ambiguity in field definitions (e.g., metadataHash vs disputeDeadline duplication).

Before relying on this README as fully precise documentation of the “current” implementation details (function names, DTO shapes, entity fields), the conflicts should be resolved and the documentation regenerated.

---

## 13) Appendix: escrow default resolution (cron workflow)

A conceptual step-by-step of the default resolution scheduler:

1. Dispute is filed against an escrow
2. Backend sets `escrow.disputeDeadline = filingTime + X days`
3. Scheduler periodically searches for:
   - escrow.status == `disputed`
   - escrow.disputeDeadline <= now
4. For each candidate escrow, scheduler invokes escrow service to apply fallback
5. Escrow service:
   - verifies dispute still open
   - applies fallback outcome (refund or 50/50 split)
   - updates escrow/dispute DB status
   - triggers on-chain resolution when configured/possible
6. Events are logged and webhooks may be dispatched

This yields a robust “eventually resolve disputes” behavior.

---

## Conclusion

Vaultix / QuickEx provides an end-to-end escrow experience powered by Stellar:

- Frontend: user flows and wallet integration
- Backend: orchestration, persistence, events, scheduling
- On-chain: deterministic enforcement of payout and settlement

Once the merge conflict markers are resolved, this README can be further updated to match the exact final code paths, DTO names, and entity field shapes.

