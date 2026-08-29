# Escrow Status Model — Cross-Layer Mapping

This document reconciles the escrow status representations across the contract, backend, frontend, and mobile layers.

> **Issue #580:** The same escrow status means different things in different layers. Each client invents its own mapping and states silently render as "unknown." This doc is the canonical reconciliation.

---

## Layer Source References

| Layer | File | Status type |
|---|---|---|
| **Contract** (Soroban/Rust) | `apps/onchain/src/lib.rs` (lines 52–61) | `EscrowStatus` enum |
| **Backend** (NestJS/TypeScript) | `apps/backend/src/modules/escrow/entities/escrow.entity.ts` (lines 17–25) | `EscrowStatus` enum |
| **Frontend** (Next.js/TypeScript) | `apps/frontend/types/escrow.ts` (lines 10–24) | `IEscrow.status` union |
| **Mobile** (Expo/TypeScript) | `apps/mobile/types/escrow.ts` (lines 1–9) | `EscrowStatus` union |

---

## Escrow Status Mapping Table

| Contract (Rust) | Backend (NestJS) | Frontend (Next.js) | Mobile (Expo) | Mapping notes |
|---|---|---|---|---|
| `Created` | `PENDING` (`'pending'`) | `'created'` | `'created'` | Direct map. Contract: escrow created but not funded. Backend: awaiting deposit. |
| `Active` | `ACTIVE` (`'active'`) | `'funded'` | `'funded'` | **Alias:** Frontend and Mobile use `funded` to represent the contract's `Active` (funds deposited and locked). |
| `Completed` | `COMPLETED` (`'completed'`) | `'completed'` | `'completed'` | Direct map. All milestones released. |
| `Cancelled` | `CANCELLED` (`'cancelled'`) | `'cancelled'` | `'cancelled'` | Direct map. Escrow cancelled, funds refunded. |
| `Disputed` | `DISPUTED` (`'disputed'`) | `'disputed'` | `'disputed'` | Direct map. |
| `Resolved` | — | — | — | **Gap:** Backend, frontend, and mobile have **no `Resolved` status.** A resolved dispute is currently mapped to `COMPLETED` on the backend. See [Known Gaps](#known-gaps). |
| `Expired` | `EXPIRED` (`'expired'`) | `'expired'` | `'expired'` | Direct map. Escrow expired and refunded. |

### Backend-only statuses

| Backend status | Contract equivalent | Notes |
|---|---|---|
| `REFUNDED` (`'refunded'`) | N/A (post-cancellation/expiry state) | Backend uses this to distinguish "cancelled with refund" from "cancelled without refund." Contract has no explicit refunded state — it is implicit in `Cancelled` or `Expired`. |

### Frontend-only statuses

| Frontend status | Contract equivalent | Notes |
|---|---|---|
| `'confirmed'` | N/A (intermediate) | Frontend-only status used between `funded` and `released` to represent delivery confirmation before milestone release. No direct contract equivalent. |
| `'released'` | N/A (intermediate) | Frontend-only status for when a milestone has been released but the escrow is not yet `completed`. Maps to contract `Active` (still has pending milestones) or `Completed` (last milestone released). |
| `'PENDING'` | `Created` | Legacy uppercase variant still present in the union type. Should be migrated to lowercase `'created'`. |
| `'ACTIVE'` | `Active` | Legacy uppercase variant. Should be migrated to lowercase `'funded'`. |
| `'COMPLETED'` | `Completed` | Legacy uppercase variant. |
| `'CANCELLED'` | `Cancelled` | Legacy uppercase variant. |
| `'DISPUTED'` | `Disputed` | Legacy uppercase variant. |
| `'EXPIRED'` | `Expired` | Legacy uppercase variant. |

---

## Milestone Status Mapping

| Contract (Rust) | Backend | Frontend | Mobile | Notes |
|---|---|---|---|---|
| `Pending` | `pending` | `'pending'` | `'pending'` | Direct map. |
| `Released` | `released` | `'released'` | `'released'` | Direct map. |
| `Disputed` | — | — | — | **Gap:** Backend, frontend, and mobile have **no `Disputed` milestone status.** A disputed milestone is rendered as `pending` (its pre-dispute state) on all clients. See [Known Gaps](#known-gaps). |

**Contract source:** `apps/onchain/src/lib.rs` lines 37–41
```rust
pub enum MilestoneStatus {
    Pending,
    Released,
    Disputed,
}
```

---

## Legal State Transition Graph

The contract (`apps/onchain/src/invariants.rs`) and backend (`escrow-state-machine.ts`) enforce the following transitions:

### Contract transitions (enforced by `validate_status_transition`)

```
Created ──deposit_funds──→ Active
Created ──cancel_escrow──→ Cancelled
Active  ──release_milestone (last)──→ Completed
Active  ──cancel_escrow──→ Cancelled
Active  ──raise_dispute──→ Disputed
Active  ──expire_escrow──→ Expired
Disputed ──resolve_dispute──→ Resolved
```

**Terminal states:** `Completed`, `Cancelled`, `Resolved`, `Expired`

### Backend transitions (enforced by `validateTransition` in `escrow-state-machine.ts`)

```
PENDING ──→ ACTIVE | CANCELLED | EXPIRED
ACTIVE  ──→ COMPLETED | CANCELLED | DISPUTED | EXPIRED | REFUNDED
DISPUTED ──→ COMPLETED | CANCELLED | EXPIRED
```

**Terminal states:** `COMPLETED`, `CANCELLED`, `EXPIRED`, `REFUNDED`

**Key difference:** The backend has no `RESOLVED` state — when a dispute is resolved, the escrow transitions to `COMPLETED` (if the resolution completes the escrow) or `CANCELLED` (if the resolution refunds). The contract's `Resolved` is a distinct state that persists until explicitly completed or cancelled.

---

## Client-Only Aliases

| Alias | Used in | Represents | Reason |
|---|---|---|---|
| `funded` | Frontend, Mobile | Contract `Active` | UI convention: the user sees "Funded" when funds are deposited, not "Active." The term "Active" is ambiguous to end users. |
| `confirmed` | Frontend only | Intermediate state | Used between `funded` and `released` to show delivery confirmation before milestone release. This is a UI-level state that does not exist on-chain. |
| `released` | Frontend only | Intermediate state | Used when a milestone has been released but the escrow is not yet complete. This is a UI aggregation of the contract's `Active` + milestone `Released` states. |
| `refunded` | Backend only | Post-cancellation/expiry | Distinguishes escrows where a refund actually occurred from those that were cancelled without funds. |

---

## Known Gaps

### Gap 1: Contract `Resolved` has no client representation

The contract has a `Resolved` status that persists after a dispute is resolved but before the escrow is fully completed or cancelled. Neither the backend, frontend, nor mobile has a `Resolved` status.

**Current behavior:** The backend maps `Resolved` to `COMPLETED` (if funds were released) or `CANCELLED` (if funds were refunded). This means the client cannot distinguish "resolved in favor of recipient" from "normally completed" or "resolved in favor of depositor" from "normally cancelled."

**Impact:** Users cannot see the dispute resolution history in the status. The `DisputeResolvedEvent` on chain carries the resolution details (`Resolution::Depositor`, `Recipient`, or `Split`), but this is not reflected in the escrow status on any client.

**Recommendation:** Add a `RESOLVED` status to the backend enum and a `'resolved'` status to the frontend and mobile unions. This would require updating the state machine and all status rendering code.

### Gap 2: Contract `Disputed` milestone has no client representation

The contract has a `Disputed` variant in `MilestoneStatus`, but the backend, frontend, and mobile only have `pending` and `released`.

**Current behavior:** A disputed milestone is rendered as `pending` on all clients, which is misleading — the milestone is not actionable in the same way as a truly pending one.

**Impact:** Users cannot see which milestones are disputed. They must infer this from the escrow-level `Disputed` status.

**Recommendation:** Add a `'disputed'` milestone status to the mobile and frontend type unions and render it with a distinct badge color.

### Gap 3: Frontend has mixed-case status union

The frontend `IEscrow.status` type includes both lowercase (`'created'`, `'funded'`, etc.) and uppercase (`'PENDING'`, `'ACTIVE'`, etc.) variants. This suggests a partially completed migration and means every status comparison must handle both cases.

**Impact:** Status badges and filters may miss the uppercase variants, causing escrows to render as "unknown."

**Recommendation:** Standardize on lowercase and migrate the API layer to consistently return lowercase. Remove the uppercase variants from the union type once the API is confirmed to only return lowercase.

---

## Related Documentation

- [Contract Events](./contract/EVENTS.md) — Events emitted at each state transition
- [Contract Data Models](./contract/DATA_MODELS.md) — Escrow and Milestone struct definitions
- [Contract Workflows](./contract/WORKFLOWS.md) — Escrow lifecycle workflows
