# Escrow Status Model — Cross-Layer Mapping

This document reconciles the escrow and milestone status enumerations used across the Soroban contract, the backend indexer, and the frontend/mobile clients. It is the single source of truth for status semantics and prevents each client from inventing its own mapping.

> **Related:** [`docs/contract/DATA_MODELS.md`](contract/DATA_MODELS.md) · [`docs/contract/EVENTS.md`](contract/EVENTS.md)

---

## Escrow Status Mapping

| Contract `EscrowStatus` | Backend DB value | Frontend label | Mobile label | Notes |
|---|---|---|---|---|
| `Created` | `created` | "Awaiting Deposit" | `'created'` | Escrow initialized, no funds yet |
| `Active` | `active` | "In Progress" | `'funded'` ⚠️ | **Mobile alias** — see note below |
| `Completed` | `completed` | "Completed" | `'completed'` | All milestones released |
| `Cancelled` | `cancelled` | "Cancelled" | `'cancelled'` | Terminated, funds refunded |
| `Disputed` | `disputed` | "Disputed" | `'disputed'` | Frozen pending arbitration |
| `Resolved` | `resolved` | "Resolved" | ❌ **MISSING** | See [Known Gap #1](#known-gap-1-resolved-state-not-in-mobile) |
| `Expired` | `expired` | "Expired" | `'expired'` | Deadline passed, funds refunded |

### Mobile-only aliases

| Mobile value | Maps to contract | Reason |
|---|---|---|
| `'funded'` | `Active` | Mobile treats "funded" as the user-visible description of an active escrow. The contract term `Active` is more precise but less user-friendly. This is an intentional UX alias, not a semantic difference. |
| `'confirmed'` | `Active` (sub-state) | Used transiently in the mobile UI to indicate a deposit transaction has been confirmed on-chain but the indexer has not yet emitted the `FundsDeposited` event. This is a **client-only** transient state — it does not exist in the contract or backend. |

---

## Milestone Status Mapping

| Contract `MilestoneStatus` | Backend DB value | Frontend label | Mobile label | Notes |
|---|---|---|---|---|
| `Pending` | `pending` | "Pending" | `'pending'` | Awaiting release |
| `Released` | `released` | "Released" | `'released'` | Funds disbursed |
| `Disputed` | `disputed` | "Disputed" | ❌ **MISSING** | See [Known Gap #2](#known-gap-2-disputed-milestone-state-not-in-mobile) |

---

## Legal State-Transition Graph

The following transitions are enforced by the contract (`validate_status_transition` and inline guards). Terminal states are marked **[terminal]**.

```
(new escrow)
     │
     ▼
  Created ──────────────────────────────────────────► Cancelled [terminal]
     │
     │ deposit_funds
     ▼
  Active ────────────────────────────────────────────► Cancelled [terminal]
     │                      │                │
     │ release_milestone     │ raise_dispute   │ refund_expired (deadline passed)
     │ (all done)            │                │
     ▼                      ▼                ▼
 Completed [terminal]   Disputed         Expired [terminal]
                            │
                            │ resolve_dispute
                            ▼
                        Resolved [terminal]
```

### Milestone state transitions (per milestone, while escrow is `Active`)

```
Pending ──► Released [terminal]   (via release_milestone / confirm_delivery)
Pending ──► Disputed              (via raise_dispute — all pending milestones frozen)
Disputed ──► Released             (via resolve_dispute — arbitrator may release)
Disputed ──► Disputed             (remains disputed until resolution)
```

**Terminal escrow states:** `Completed`, `Cancelled`, `Resolved`, `Expired`
**Terminal milestone state:** `Released`

---

## Known Gaps

### Known Gap #1 — `resolved` state not in mobile

- **Contract state:** `EscrowStatus::Resolved`
- **Backend DB value:** `resolved`
- **Mobile `EscrowStatus` type:** does **not** include `'resolved'`
- **Symptom:** A resolved escrow renders as `undefined`/unknown in mobile status badges, filters, and the dashboard chip.
- **Fix:** Add `'resolved'` to the mobile `EscrowStatus` union and handle it in all switch/conditional branches. See issue [#558](https://github.com/StayLitCodes/Vaultix/issues/558).

### Known Gap #2 — disputed milestone state not in mobile

- **Contract state:** `MilestoneStatus::Disputed`
- **Backend DB value:** `disputed`
- **Mobile `MilestoneStatus` type:** only `'pending' | 'released'`
- **Symptom:** A milestone frozen in a dispute renders as `'pending'` in the mobile UI, giving no indication that it is blocked.
- **Fix:** Add `'disputed'` to the mobile `MilestoneStatus` union and render it with a distinct badge. See issue [#558](https://github.com/StayLitCodes/Vaultix/issues/558).

### Known Gap #3 — `active` not in mobile

- **Contract state:** `EscrowStatus::Active`
- **Mobile alias:** `'funded'`
- **Risk:** The `active` value may arrive from the backend for escrows in states the mobile UI maps to `funded`. If the backend ever normalizes to `active` instead of `funded`, mobile filters and status chips will silently stop matching.
- **Fix:** The mobile `EscrowStatus` type should include both `'funded'` and `'active'` as valid values, with `'funded'` treated as the display alias. See issue [#558](https://github.com/StayLitCodes/Vaultix/issues/558).

---

## Cross-Service Agreement Points

These values must agree across all services. Any drift will cause silent mismatches:

| Value | Backend | Frontend | Mobile |
|---|---|---|---|
| API base URL | `PORT` / `API_BASE_URL` | `NEXT_PUBLIC_API_BASE_URL` | `EXPO_PUBLIC_API_BASE_URL` / `EXPO_PUBLIC_API_URL` ⚠️ duplicate |
| Stellar network | `STELLAR_NETWORK` | `NEXT_PUBLIC_STELLAR_NETWORK` | `EXPO_PUBLIC_APP_ENV` (maps to network) |
| Contract ID | served via `/api/config` | read from API or `NEXT_PUBLIC_CONTRACT_ID` | read from API |
