# Contract Event Schema Reference

This document describes every event emitted by the Vaultix escrow contract, their topic conventions, payload structures, and the state transitions they represent.

> **Issue #578:** Previously, indexer authors had to read `lib.rs` to find out what events they could subscribe to. This file is the canonical reference for all contract events.

---

## Topic Convention

All events published by the contract use a three-part topic tuple:

```
(Vaultix, <schema_version>, <event_name>)
```

| Topic position | Value | Description |
|---|---|---|
| 0 — Namespace | `Vaultix` | Contract namespace, defined as `EVENT_NAMESPACE` in `lib.rs` (line 454) |
| 1 — Schema version | `v1` | Event schema version, defined as `EVENT_SCHEMA_VERSION` in `lib.rs` (line 455) |
| 2 — Event name | e.g. `EscrowCreated` | The specific event name (see tables below) |

### Constants

```rust
// apps/onchain/src/lib.rs
const EVENT_NAMESPACE: &str = "Vaultix";       // line 454
const EVENT_SCHEMA_VERSION: &str = "v1";       // line 455
```

### Helper functions

```rust
// lib.rs line 2232
fn publish_event<T, D>(env: &Env, topics: T, data: D)
where T: Topics, D: IntoVal<Env, Val>

// lib.rs line 2240
fn event_topic(env: &Env, event_name: &str) -> (Symbol, Symbol, Symbol)
```

---

## Escrow Lifecycle Events

These events track the lifecycle of an escrow from creation to completion/cancellation/expiry.

### `EscrowCreated`

| Property | Value |
|---|---|
| **Entrypoint** | `create_escrow()` |
| **State transition** | (none) → `Created` |
| **Topic tuple** | `(Vaultix, v1, EscrowCreated)` |

**Payload:** `EscrowCreatedEvent`

| Field | Type | Description |
|---|---|---|
| `escrow_id` | `u64` | Unique escrow identifier |
| `depositor` | `Address` | Address of the depositor (funder) |
| `recipient` | `Address` | Address of the recipient (payee) |
| `token_address` | `Address` | Stellar asset contract address |
| `total_amount` | `i128` | Total escrow amount (sum of milestones) |
| `total_released` | `i128` | Amount released so far (0 at creation) |
| `status` | `EscrowStatus` | `Created` |
| `deadline` | `u64` | Ledger timestamp deadline |
| `metadata_hash` | `BytesN<32>` | SHA-256 hash of off-chain metadata |
| `timestamp` | `u64` | Ledger timestamp at creation |

---

### `EscrowCreatedBatch`

| Property | Value |
|---|---|
| **Entrypoint** | `create_escrow_batch()` |
| **State transition** | (none) → `Created` (per item) |
| **Topic tuple** | `(Vaultix, v1, EscrowCreatedBatch)` |

**Payload:** `EscrowCreatedBatchEvent`

| Field | Type | Description |
|---|---|---|
| `batch_size` | `u32` | Number of escrows in this batch |
| `items` | `Vec<EscrowCreatedBatchEventItem>` | Per-escrow summary (same fields as `EscrowCreatedEvent` without `timestamp`) |
| `timestamp` | `u64` | Ledger timestamp at batch creation |

Each `EscrowCreatedBatchEventItem` contains: `escrow_id`, `depositor`, `recipient`, `token_address`, `total_amount`, `total_released`, `status`, `deadline`, `metadata_hash`.

---

### `FundsDeposited`

| Property | Value |
|---|---|
| **Entrypoint** | `deposit_funds()` |
| **State transition** | `Created` → `Active` |
| **Topic tuple** | `(Vaultix, v1, FundsDeposited)` |

**Payload:** `FundsDepositedEvent`

| Field | Type | Description |
|---|---|---|
| `escrow_id` | `u64` | Escrow identifier |
| `depositor` | `Address` | Address that deposited funds |
| `recipient` | `Address` | Escrow recipient |
| `token_address` | `Address` | Token contract address |
| `total_amount` | `i128` | Total escrow amount |
| `status` | `EscrowStatus` | `Active` |
| `total_released` | `i128` | Amount released so far |
| `deadline` | `u64` | Escrow deadline |
| `timestamp` | `u64` | Ledger timestamp |

---

### `SignatureCollected`

| Property | Value |
|---|---|
| **Entrypoint** | `collect_signature()` |
| **State transition** | No status change (signature accumulation) |
| **Topic tuple** | `(Vaultix, v1, SignatureCollected)` |

**Payload:** *(emitted inline — signer address and escrow state)*

> **Deviation flag:** This event is emitted with inline data rather than a dedicated `#[contracttype]` struct. It does not deviate from the topic convention, but its payload is not a typed struct — consumers should parse the raw `Val` data. This is flagged for potential convergence with the typed-struct pattern in a future schema version.

---

### `MilestoneReleased`

| Property | Value |
|---|---|
| **Entrypoint** | `release_milestone()` |
| **State transition** | `Active` → `Active` (or `Completed` if last milestone) |
| **Topic tuple** | `(Vaultix, v1, MilestoneReleased)` |

**Payload:** `MilestoneReleasedEvent`

| Field | Type | Description |
|---|---|---|
| `escrow_id` | `u64` | Escrow identifier |
| `milestone_index` | `u32` | Index of the released milestone |
| `depositor` | `Address` | Escrow depositor |
| `recipient` | `Address` | Escrow recipient |
| `token_address` | `Address` | Token contract address |
| `milestone_amount` | `i128` | Original milestone amount |
| `payout_amount` | `i128` | Actual payout (after fee) |
| `fee_amount` | `i128` | Fee deducted |
| `total_released` | `i128` | Cumulative released amount |
| `status` | `EscrowStatus` | Current status (`Active` or `Completed`) |
| `total_amount` | `i128` | Total escrow amount |
| `deadline` | `u64` | Escrow deadline |
| `timestamp` | `u64` | Ledger timestamp |

---

### `DeliveryConfirmed`

| Property | Value |
|---|---|
| **Entrypoint** | `confirm_delivery()` |
| **State transition** | `Active` → `Active` (or `Completed` if last milestone) |
| **Topic tuple** | `(Vaultix, v1, DeliveryConfirmed)` |

**Payload:** `DeliveryConfirmedEvent`

| Field | Type | Description |
|---|---|---|
| `escrow_id` | `u64` | Escrow identifier |
| `milestone_index` | `u32` | Index of the confirmed milestone |
| `confirmed_by` | `Address` | Address that confirmed delivery |
| `depositor` | `Address` | Escrow depositor |
| `recipient` | `Address` | Escrow recipient |
| `token_address` | `Address` | Token contract address |
| `milestone_amount` | `i128` | Milestone amount |
| `payout_amount` | `i128` | Payout amount (after fee) |
| `fee_amount` | `i128` | Fee deducted |
| `total_released` | `i128` | Cumulative released |
| `status` | `EscrowStatus` | Current status |
| `total_amount` | `i128` | Total escrow amount |
| `deadline` | `u64` | Escrow deadline |
| `timestamp` | `u64` | Ledger timestamp |

---

### `DisputeRaised`

| Property | Value |
|---|---|
| **Entrypoint** | `raise_dispute()` |
| **State transition** | `Active` → `Disputed` |
| **Topic tuple** | `(Vaultix, v1, DisputeRaised)` |

**Payload:** `DisputeRaisedEvent`

| Field | Type | Description |
|---|---|---|
| `escrow_id` | `u64` | Escrow identifier |
| `raised_by` | `Address` | Address that raised the dispute |
| `depositor` | `Address` | Escrow depositor |
| `recipient` | `Address` | Escrow recipient |
| `evidence_hash` | `BytesN<32>` | SHA-256 hash of off-chain evidence bundle |
| `status` | `EscrowStatus` | `Disputed` |
| `total_amount` | `i128` | Total escrow amount |
| `total_released` | `i128` | Amount released so far |
| `deadline` | `u64` | Escrow deadline |
| `timestamp` | `u64` | Ledger timestamp |

---

### `DisputeResolved`

| Property | Value |
|---|---|
| **Entrypoint** | `resolve_dispute()` |
| **State transition** | `Disputed` → `Resolved` |
| **Topic tuple** | `(Vaultix, v1, DisputeResolved)` |

**Payload:** `DisputeResolvedEvent`

| Field | Type | Description |
|---|---|---|
| `escrow_id` | `u64` | Escrow identifier |
| `winner` | `Address` | Address of the winning party |
| `other_party` | `Address` | Address of the losing party |
| `winner_amount` | `i128` | Amount awarded to the winner |
| `other_amount` | `i128` | Amount awarded to the other party |
| `resolution` | `Resolution` | `Depositor`, `Recipient`, or `Split` |
| `resolution_evidence_hash` | `Option<BytesN<32>>` | SHA-256 of arbitrator's evidence, or `None` |
| `status` | `EscrowStatus` | `Resolved` |
| `total_amount` | `i128` | Total escrow amount |
| `total_released` | `i128` | Cumulative released |
| `deadline` | `u64` | Escrow deadline |
| `timestamp` | `u64` | Ledger timestamp |

---

### `EscrowCancelled`

| Property | Value |
|---|---|
| **Entrypoint** | `cancel_escrow()` |
| **State transition** | `Created`/`Active` → `Cancelled` |
| **Topic tuple** | `(Vaultix, v1, EscrowCancelled)` |

**Payload:** `EscrowCancelledEvent`

| Field | Type | Description |
|---|---|---|
| `escrow_id` | `u64` | Escrow identifier |
| `cancelled_by` | `Address` | Address that cancelled the escrow |
| `depositor` | `Address` | Escrow depositor (refund recipient) |
| `token_address` | `Address` | Token contract address |
| `refund_amount` | `i128` | Amount refunded |
| `fee_amount` | `i128` | Fee amount |
| `status` | `EscrowStatus` | `Cancelled` |
| `total_amount` | `i128` | Total escrow amount |
| `total_released` | `i128` | Amount released before cancellation |
| `deadline` | `u64` | Escrow deadline |
| `timestamp` | `u64` | Ledger timestamp |

---

### `EscrowCompleted`

| Property | Value |
|---|---|
| **Entrypoint** | `release_milestone()` (auto-emitted when last milestone is released) |
| **State transition** | `Active` → `Completed` |
| **Topic tuple** | `(Vaultix, v1, EscrowCompleted)` |

**Payload:** `EscrowCompletedEvent`

| Field | Type | Description |
|---|---|---|
| `escrow_id` | `u64` | Escrow identifier |
| `completed_by` | `Address` | Address that triggered completion |
| `total_released` | `i128` | Total amount released |
| `status` | `EscrowStatus` | `Completed` |
| `total_amount` | `i128` | Total escrow amount |
| `deadline` | `u64` | Escrow deadline |
| `timestamp` | `u64` | Ledger timestamp |

---

### `EscrowExpiredRefunded`

| Property | Value |
|---|---|
| **Entrypoint** | `expire_escrow()` |
| **State transition** | `Active` → `Expired` |
| **Topic tuple** | `(Vaultix, v1, EscrowExpiredRefunded)` |

**Payload:** `EscrowExpiredRefundedEvent`

| Field | Type | Description |
|---|---|---|
| `escrow_id` | `u64` | Escrow identifier |
| `refunded_to` | `Address` | Address receiving the refund (depositor) |
| `token_address` | `Address` | Token contract address |
| `refund_amount` | `i128` | Amount refunded |
| `fee_amount` | `i128` | Fee amount |
| `status` | `EscrowStatus` | `Expired` |
| `total_amount` | `i128` | Total escrow amount |
| `total_released` | `i128` | Amount released before expiry |
| `deadline` | `u64` | Escrow deadline |
| `timestamp` | `u64` | Ledger timestamp |

---

## Admin & Configuration Events

### `ContractUpgraded`

| Property | Value |
|---|---|
| **Entrypoint** | `upgrade()` |
| **State transition** | N/A (contract WASM upgrade) |
| **Topic tuple** | `(Vaultix, v1, ContractUpgraded)` |

**Payload:** `BytesN<32>` — the new WASM hash

> **Deviation flag:** This event's payload is a raw `BytesN<32>` (the WASM hash) rather than a typed struct. This is intentional — the upgrade event carries only the hash. Flagged for consistency but not a breaking deviation.

---

### `AdminProposed`

| Property | Value |
|---|---|
| **Entrypoint** | `propose_admin()` |
| **State transition** | N/A (admin proposal, not a status change) |
| **Topic tuple** | `(Vaultix, v1, AdminProposed)` |

**Payload:** `AdminProposedEvent`

| Field | Type | Description |
|---|---|---|
| `caller` | `Address` | Current admin proposing the transfer |
| `new_admin` | `Address` | Proposed new admin address |
| `expires_at` | `u64` | Proposal expiry timestamp (7-day window) |
| `timestamp` | `u64` | Ledger timestamp |

---

### `AdminProposalCancelled`

| Property | Value |
|---|---|
| **Entrypoint** | `cancel_admin_proposal()` |
| **State transition** | N/A (cancels a pending proposal) |
| **Topic tuple** | `(Vaultix, v1, AdminProposalCancelled)` |

**Payload:** `AdminProposalCancelledEvent`

| Field | Type | Description |
|---|---|---|
| `caller` | `Address` | Admin that cancelled the proposal |
| `new_admin` | `Address` | The proposed admin that was cancelled |
| `timestamp` | `u64` | Ledger timestamp |

---

### `RoleUpdated`

| Property | Value |
|---|---|
| **Entrypoint** | `set_role()` / `accept_admin()` |
| **State transition** | N/A (role assignment) |
| **Topic tuple** | `(Vaultix, v1, RoleUpdated)` |

**Payload:** `RoleUpdatedEvent`

| Field | Type | Description |
|---|---|---|
| `role` | `Role` | `Admin`, `Operator`, `Arbitrator`, or `Treasury` |
| `had_old_address` | `bool` | Whether a previous address existed |
| `old_address` | `Address` | Previous address (zero address if none) |
| `new_address` | `Address` | New address assigned to the role |
| `timestamp` | `u64` | Ledger timestamp |

---

### `FeeUpdated`

| Property | Value |
|---|---|
| **Entrypoint** | `set_fee()` / `set_global_fee()` / `set_token_fee()` / `set_escrow_fee()` / `remove_fee_override()` |
| **State transition** | N/A (fee configuration) |
| **Topic tuple** | `(Vaultix, v1, FeeUpdated)` |

**Payload:** `FeeUpdatedEvent`

| Field | Type | Description |
|---|---|---|
| `scope` | `FeeScope` | `Global`, `Token`, or `Escrow` |
| `has_escrow_id` | `bool` | Whether `escrow_id` is meaningful |
| `escrow_id` | `u64` | Escrow ID (if scope is `Escrow`) |
| `has_token_address` | `bool` | Whether `token_address` is meaningful |
| `token_address` | `Address` | Token address (if scope is `Token`) |
| `old_fee_bps` | `i128` | Previous fee in basis points |
| `new_fee_bps` | `i128` | New fee in basis points |
| `timestamp` | `u64` | Ledger timestamp |

> **Note:** `FeeUpdated` is emitted by multiple entrypoints (5 different fee-setting functions). All emit the same event struct — the `scope` field distinguishes them.

---

### `PausedToggled`

| Property | Value |
|---|---|
| **Entrypoint** | `toggle_pause()` |
| **State transition** | `Active` ⇄ `Paused` (contract-level pause) |
| **Topic tuple** | `(Vaultix, v1, PausedToggled)` |

**Payload:** `PausedToggledEvent`

| Field | Type | Description |
|---|---|---|
| `paused` | `bool` | `true` if now paused, `false` if unpaused |
| `caller` | `Address` | Address that toggled the pause |
| `caller_role` | `Role` | Role of the caller |
| `timestamp` | `u64` | Ledger timestamp |

---

### `MultisigConfigured`

| Property | Value |
|---|---|
| **Entrypoint** | `configure_multisig()` |
| **State transition** | N/A (multisig configuration) |
| **Topic tuple** | `(Vaultix, v1, MultisigConfigured)` |

**Payload:** *(emitted inline — escrow ID, threshold, and signer list)*

> **Deviation flag:** Like `SignatureCollected`, this event emits inline data rather than a dedicated typed struct. Flagged for convergence in a future schema version.

---

## State Transition Graph

The following diagram shows the legal escrow status transitions and which event is emitted at each:

```
                    ┌──────────┐
                    │  Created │ ← EscrowCreated
                    └────┬─────┘
                         │ FundsDeposited
                         ▼
                    ┌──────────┐
          ┌─────────│  Active  │─────────┐
          │         └────┬─────┘         │
          │              │               │
          │ DisputeRaised│               │ MilestoneReleased
          │              │               │ (last milestone)
          ▼              ▼               ▼
   ┌──────────┐   ┌──────────┐    ┌───────────┐
   │ Cancelled│   │ Disputed │    │ Completed │
   └──────────┘   └────┬─────┘    └───────────┘
       ↑               │ DisputeResolved
       │               ▼
       │          ┌──────────┐
       │          │ Resolved │
       │          └──────────┘
       │
       │ expire_escrow
       └──────────────────────────────────┐
                                        ▼
                                  ┌──────────┐
                                  │ Expired  │
                                  └──────────┘
```

**Terminal states:** `Completed`, `Cancelled`, `Resolved`, `Expired`

---

## Schema Version Bump Strategy

When the event schema needs to change (e.g., adding fields, removing events, changing types):

1. **Increment `EVENT_SCHEMA_VERSION`** from `v1` to `v2` in `lib.rs` (line 455).
2. **Consumers** should filter on topic position 1 (schema version) and handle each version independently.
3. **Backward compatibility:** During a migration period, the contract can emit both v1 and v2 events (by calling `publish_event` with different topic tuples) so consumers have time to upgrade.
4. **Breaking changes** (field removals, type changes) require a version bump. **Additive changes** (new optional fields) may not require a bump if consumers use a tolerant parser, but a bump is recommended for clarity.
5. **This document** must be updated whenever a new schema version is introduced.

---

## Related Documentation

- [Data Models](./DATA_MODELS.md) — Escrow, Milestone, and other contract types
- [Errors](./ERRORS.md) — Contract error codes
- [Workflows](./WORKFLOWS.md) — Escrow lifecycle workflows
- [Deployment](./DEPLOYMENT.md) — Contract deployment and upgrade guide
