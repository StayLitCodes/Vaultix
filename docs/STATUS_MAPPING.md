# Escrow Status Model — Cross-Layer Mapping

This document reconciles the escrow and milestone status enumerations used across the Soroban contract, the backend indexer, and the frontend/mobile clients. It is the single source of truth for status semantics and prevents each client from inventing its own mapping.

> **Related:** [`docs/contract/DATA_MODELS.md`](contract/DATA_MODELS.md) · [`docs/contract/EVENTS.md`](contract/EVENTS.md)

---

## Escrow Status Mapping

| Contract `EscrowStatus` | Backend DB value | Frontend label | Mobile label | Notes |
|---|---|---|---|---|
| `Created` | `created` | "Awaiting Deposit" | `'created'` | Escrow initialized, no funds yet |
| `Active` | `active` | "In Progress" | `'active'` / `'funded'` ⚠️ | Mobile accepts the canonical `'active'` **and** the `'funded'` UX alias — both render as "In Progress". See [Mobile-only aliases](#mobile-only-aliases) |
| `Completed` | `completed` | "Completed" | `'completed'` | All milestones released |
| `Cancelled` | `cancelled` | "Cancelled" | `'cancelled'` | Terminated, funds refunded |
| `Disputed` | `disputed` | "Disputed" | `'disputed'` | Frozen pending arbitration |
| `Resolved` | `resolved` | "Resolved" | `'resolved'` | Arbitrator ruled; terminal. Label via `escrowStatusLabel()` in [`apps/mobile/types/escrow.ts`](../apps/mobile/types/escrow.ts) |
| `Expired` | `expired` | "Expired" | `'expired'` | Deadline passed, funds refunded |

### Mobile-only aliases

| Mobile value | Maps to contract | Reason |
|---|---|---|
| `'funded'` | `Active` | Mobile treats "funded" as the user-visible description of an active escrow. The contract term `Active` is more precise but less user-friendly. This is an intentional UX alias, not a semantic difference. Mobile accepts **both** `'funded'` and `'active'` so a backend that normalises to either value still matches. |
| `'confirmed'` | `Active` (sub-state) | Used transiently in the mobile UI to indicate a deposit transaction has been confirmed on-chain but the indexer has not yet emitted the `FundsDeposited` event. This is a **client-only** transient state — it does not exist in the contract or backend. |
| `'released'` | `Active` (escrow-level) | Emitted by some backend responses once the final milestone is released but before the contract rolls the escrow to `Completed`. Mobile treats it like `Completed` for display purposes. |

---

## Milestone Status Mapping

| Contract `MilestoneStatus` | Backend DB value | Frontend label | Mobile label | Notes |
|---|---|---|---|---|
| `Pending` | `pending` | "Pending" | `'pending'` | Awaiting release |
| `Released` | `released` | "Released" | `'released'` | Funds disbursed |
| `Disputed` | `disputed` | "Disputed" | `'disputed'` | Frozen while the parent escrow is disputed. Label via `milestoneStatusLabel()` in [`apps/mobile/types/escrow.ts`](../apps/mobile/types/escrow.ts) |

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

## Known client-representation gaps

These are the cases where a client could not represent a contract state. Each is
tracked as a numbered issue and the current status is recorded so readers can see
whether a client is safe to trust today.

| Gap | Contract state the client could not represent | Affected client | Tracking issue | Current status |
|---|---|---|---|---|
| Escrow-status action gating checks statuses the contract never produces (`funded`/`confirmed`/`released`) while omitting `Active`/`Resolved`, so dispute/milestone actions never fire | `EscrowStatus::Active`, `EscrowStatus::Resolved` | Mobile | [#714](https://github.com/StayLitCodes/Vaultix/issues/714) | **Resolved in code** — `EscrowStatus` in [`apps/mobile/types/escrow.ts`](../apps/mobile/types/escrow.ts) now accepts `'active'` and `'resolved'` (added by [#558](https://github.com/StayLitCodes/Vaultix/issues/558)); the mapping below is the reference that keeps it aligned |
| Milestone `Disputed` state absent from the mobile milestone type, so a frozen milestone rendered as `'pending'` | `MilestoneStatus::Disputed` | Mobile | [#698](https://github.com/StayLitCodes/Vaultix/issues/698) | **Resolved in code** — `MilestoneStatus` in [`apps/mobile/types/escrow.ts`](../apps/mobile/types/escrow.ts) now includes `'disputed'` (added by [#558](https://github.com/StayLitCodes/Vaultix/issues/558)) |

> These gaps are **resolved in the mobile type definitions**, but they are listed
> here (rather than silently dropped) because the underlying issues [#714](https://github.com/StayLitCodes/Vaultix/issues/714)
> and [#698](https://github.com/StayLitCodes/Vaultix/issues/698) track the full
> client behaviour, and this table is the single reference that keeps every client
> from reintroducing the same divergence.

---

## Resolved Gaps

All three gaps previously listed here were closed in [`apps/mobile/types/escrow.ts`](../apps/mobile/types/escrow.ts) by [#558](https://github.com/StayLitCodes/Vaultix/issues/558). They are kept as a changelog so the reasons behind the mobile type definitions are not lost. See [Known client-representation gaps](#known-client-representation-gaps) above for the issues ([#714](https://github.com/StayLitCodes/Vaultix/issues/714), [#698](https://github.com/StayLitCodes/Vaultix/issues/698)) that track them.

### Resolved Gap #1 — `resolved` state not in mobile ✅ (tracked by [#714](https://github.com/StayLitCodes/Vaultix/issues/714))

- **Contract state:** `EscrowStatus::Resolved`
- **Backend DB value:** `resolved`
- **Status:** `EscrowStatus` in `apps/mobile/types/escrow.ts` now includes `'resolved'`, and `escrowStatusLabel()` maps it to "Resolved". `isTerminalEscrowStatus()` treats it as terminal, matching the transition graph below.
- **Original symptom:** A resolved escrow rendered as `undefined`/unknown in mobile status badges, filters, and the dashboard chip.

### Resolved Gap #2 — disputed milestone state not in mobile ✅ (tracked by [#698](https://github.com/StayLitCodes/Vaultix/issues/698))

- **Contract state:** `MilestoneStatus::Disputed`
- **Backend DB value:** `disputed`
- **Status:** `MilestoneStatus` in `apps/mobile/types/escrow.ts` now includes `'disputed'`, and `milestoneStatusLabel()` maps it to "Disputed".
- **Original symptom:** A milestone frozen in a dispute rendered as `'pending'` in the mobile UI, giving no indication that it is blocked.

### Resolved Gap #3 — `active` not in mobile ✅ (tracked by [#714](https://github.com/StayLitCodes/Vaultix/issues/714))

- **Contract state:** `EscrowStatus::Active`
- **Status:** `EscrowStatus` in `apps/mobile/types/escrow.ts` accepts both `'active'` (canonical) and `'funded'` (display alias); `escrowStatusLabel()` returns "In Progress" for both.
- **Original risk:** If the backend normalised to `active` instead of `funded`, mobile filters and status chips would have silently stopped matching.

> **Keeping this section honest:** any new divergence between this document and `apps/mobile/types/escrow.ts` is itself a bug. The two files reference the same issue numbers; if they disagree, the type definition wins and this document must be updated.

---

## Cross-Service Agreement Points

These values must agree across all services. Any drift will cause silent mismatches:

| Value | Backend | Frontend | Mobile |
|---|---|---|---|
| API base URL | `PORT` / `API_BASE_URL` | `NEXT_PUBLIC_API_BASE_URL` | `EXPO_PUBLIC_API_URL` (via `security/env.ts` — single source of truth) |
| Stellar network | `STELLAR_NETWORK` | `NEXT_PUBLIC_STELLAR_NETWORK` | `EXPO_PUBLIC_APP_ENV` (maps to network) |
| Contract ID | served via `/api/config` | read from API or `NEXT_PUBLIC_CONTRACT_ID` | read from API |
