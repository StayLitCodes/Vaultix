# Contract Event Schema Reference

This document describes every event emitted by the `VaultixEscrow` Soroban contract, the three-part topic convention, and guidance for consumers.

> **See also:** [`DATA_MODELS.md`](DATA_MODELS.md) for struct definitions · [`WORKFLOWS.md`](WORKFLOWS.md) for state transitions

---

## Topic Convention

Every event is published with a three-part topic tuple:

```
(Symbol("Vaultix"), Symbol(<schema_version>), Symbol(<event_name>))
```

- **`"Vaultix"`** — static namespace identifying this contract family.
- **`<schema_version>`** — value of the `EVENT_SCHEMA_VERSION` constant defined in `lib.rs` (currently `"v1"`). Consumers should validate this field on every event to detect schema bumps.
- **`<event_name>`** — the specific event name (listed below).

The helper function `event_topic(env, event_name)` in `lib.rs` constructs this tuple:

```rust
fn event_topic(env: &Env, event_name: &str) -> (Symbol, Symbol, Symbol) {
    (Symbol::new(env, "Vaultix"), Symbol::new(env, EVENT_SCHEMA_VERSION), Symbol::new(env, event_name))
}
```

### Handling a Schema Version Bump

When `EVENT_SCHEMA_VERSION` increments (e.g. `"v1"` → `"v2"`):

1. The new version will appear in the topic tuple immediately on deploy.
2. Consumers should check `topics[1]` against their supported versions and skip (or log a warning for) unknown versions.
3. Field additions are considered non-breaking within a version. Field removals or renames increment the version.

---

## Escrow Lifecycle Events

### `EscrowCreated`

Emitted by `create_escrow` when a single escrow is initialized.

| Field | Type | Description |
|---|---|---|
| `escrow_id` | `u64` | Unique escrow identifier |
| `depositor` | `Address` | Party locking the funds |
| `recipient` | `Address` | Party receiving milestone payouts |
| `token_address` | `Address` | SPL token used for payment |
| `total_amount` | `i128` | Total locked amount (raw token units) |
| `total_released` | `i128` | Always `0` at creation |
| `status` | `EscrowStatus` | Always `Created` |
| `deadline` | `u64` | Ledger timestamp after which the escrow expires |
| `metadata_hash` | `BytesN<32>` | SHA-256 digest of off-chain metadata (IPFS CID digest) |
| `timestamp` | `u64` | Ledger timestamp at emission |

**Emitted by:** `create_escrow`
**State transition:** (none) → `Created`

---

### `EscrowCreatedBatch`

Emitted by `create_escrow_batch` for bulk creation. Contains an array of items.

| Field | Type | Description |
|---|---|---|
| `items` | `Vec<EscrowCreatedBatchEventItem>` | Array of per-escrow creation summaries |

Each `EscrowCreatedBatchEventItem` has the same fields as `EscrowCreatedEvent`.

**Emitted by:** `create_escrow_batch`

---

### `FundsDeposited`

Emitted when the depositor funds an escrow, moving it from `Created` → `Active`.

| Field | Type | Description |
|---|---|---|
| `escrow_id` | `u64` | Escrow identifier |
| `depositor` | `Address` | Depositing party |
| `recipient` | `Address` | Recipient party |
| `token_address` | `Address` | Token address |
| `total_amount` | `i128` | Total locked amount |
| `total_released` | `i128` | Always `0` at this point |
| `status` | `EscrowStatus` | `Active` after deposit |
| `deadline` | `u64` | Expiry timestamp |
| `timestamp` | `u64` | Ledger timestamp |

**Emitted by:** `deposit_funds`
**State transition:** `Created` → `Active`

---

### `MilestoneReleased`

Emitted when a specific milestone is released to the recipient.

| Field | Type | Description |
|---|---|---|
| `escrow_id` | `u64` | Escrow identifier |
| `milestone_index` | `u32` | Zero-based index of the released milestone |
| `depositor` | `Address` | Depositing party |
| `recipient` | `Address` | Recipient party |
| `token_address` | `Address` | Token address |
| `milestone_amount` | `i128` | Gross milestone amount |
| `payout_amount` | `i128` | Net payout after platform fee |
| `fee_amount` | `i128` | Platform fee deducted |
| `total_released` | `i128` | Cumulative total released so far |
| `total_amount` | `i128` | Total escrow amount |
| `status` | `EscrowStatus` | `Active` (unless all milestones now released, then `Completed`) |
| `deadline` | `u64` | Expiry timestamp |
| `timestamp` | `u64` | Ledger timestamp |

**Emitted by:** `release_milestone`
**State transition:** Milestone `Pending` → `Released`; escrow stays `Active` until all milestones released, then `Completed`

---

### `DeliveryConfirmed`

Emitted when the depositor explicitly confirms delivery of a milestone (alternate release path).

Same fields as `MilestoneReleased` with the addition of:

| Field | Type | Description |
|---|---|---|
| `confirmed_by` | `Address` | Address that called `confirm_delivery` |

**Emitted by:** `confirm_delivery`

---

### `DisputeRaised`

Emitted when a party raises a dispute, freezing the escrow.

| Field | Type | Description |
|---|---|---|
| `escrow_id` | `u64` | Escrow identifier |
| `raised_by` | `Address` | Party that raised the dispute |
| `depositor` | `Address` | Depositing party |
| `recipient` | `Address` | Recipient party |
| `evidence_hash` | `BytesN<32>` | SHA-256 digest of off-chain evidence bundle |
| `status` | `EscrowStatus` | `Disputed` |
| `total_amount` | `i128` | Total escrow amount |
| `total_released` | `i128` | Cumulative amount released before dispute |
| `deadline` | `u64` | Expiry timestamp |
| `timestamp` | `u64` | Ledger timestamp |

**Emitted by:** `raise_dispute`
**State transition:** `Active` → `Disputed`; all pending milestones transition to `Disputed`

---

### `DisputeResolved`

Emitted when the arbitrator resolves a dispute.

| Field | Type | Description |
|---|---|---|
| `escrow_id` | `u64` | Escrow identifier |
| `winner` | `Address` | Party that received the majority allocation |
| `other_party` | `Address` | The other party |
| `winner_amount` | `i128` | Amount sent to winner |
| `other_amount` | `i128` | Amount sent to other party |
| `resolution` | `Resolution` | How funds were split (`FullDepositor`, `FullRecipient`, `Split`) |
| `resolution_evidence_hash` | `Option<BytesN<32>>` | Optional SHA-256 digest of arbitrator's ruling document |
| `status` | `EscrowStatus` | `Resolved` |
| `total_amount` | `i128` | Total escrow amount |
| `total_released` | `i128` | Total released after resolution |
| `deadline` | `u64` | Expiry timestamp |
| `timestamp` | `u64` | Ledger timestamp |

**Emitted by:** `resolve_dispute`
**State transition:** `Disputed` → `Resolved`

---

### `EscrowCancelled`

Emitted when an escrow is cancelled (funds returned to depositor).

| Field | Type | Description |
|---|---|---|
| `escrow_id` | `u64` | Escrow identifier |
| `cancelled_by` | `Address` | Party that cancelled |
| `depositor` | `Address` | Depositing party (refund recipient) |
| `token_address` | `Address` | Token address |
| `refund_amount` | `i128` | Net refund to depositor |
| `fee_amount` | `i128` | Platform fee withheld |
| `status` | `EscrowStatus` | `Cancelled` |
| `total_amount` | `i128` | Total escrow amount |
| `total_released` | `i128` | Amount released before cancellation |
| `deadline` | `u64` | Expiry timestamp |
| `timestamp` | `u64` | Ledger timestamp |

**Emitted by:** `cancel_escrow`
**State transition:** `Created` or `Active` → `Cancelled`

---

### `EscrowCompleted`

Emitted when all milestones have been released and the escrow is finalized.

| Field | Type | Description |
|---|---|---|
| `escrow_id` | `u64` | Escrow identifier |
| `completed_by` | `Address` | Address that triggered completion |
| `total_released` | `i128` | Total amount released |
| `status` | `EscrowStatus` | `Completed` |
| `total_amount` | `i128` | Total escrow amount |
| `deadline` | `u64` | Expiry timestamp |
| `timestamp` | `u64` | Ledger timestamp |

**Emitted by:** `complete_escrow`
**State transition:** `Active` → `Completed`

---

### `EscrowExpiredRefunded`

Emitted when the deadline passes and the depositor calls `refund_expired`.

| Field | Type | Description |
|---|---|---|
| `escrow_id` | `u64` | Escrow identifier |
| `refunded_to` | `Address` | Depositor receiving the refund |
| `token_address` | `Address` | Token address |
| `refund_amount` | `i128` | Net refund |
| `fee_amount` | `i128` | Platform fee withheld |
| `status` | `EscrowStatus` | `Expired` |
| `total_amount` | `i128` | Total escrow amount |
| `total_released` | `i128` | Amount released before expiry |
| `deadline` | `u64` | Expiry timestamp |
| `timestamp` | `u64` | Ledger timestamp |

**Emitted by:** `refund_expired`
**State transition:** `Active` → `Expired`

---

## Administrative Events

### `RoleUpdated`

Emitted when admin, operator, arbitrator, or treasury address changes.

| Field | Type | Description |
|---|---|---|
| `role` | `Role` | Which role changed (`Admin`, `Operator`, `Arbitrator`, `Treasury`) |
| `had_old_address` | `bool` | Whether there was a previous address |
| `old_address` | `Address` | Previous address (zero-value if `had_old_address` is false) |
| `new_address` | `Address` | New address |
| `timestamp` | `u64` | Ledger timestamp |

**Emitted by:** `__constructor`, `accept_admin`, `set_operator`, `set_arbitrator`, `update_treasury`

---

### `AdminProposed`

Emitted when the current admin proposes a new admin via `propose_admin`.

| Field | Type | Description |
|---|---|---|
| `caller` | `Address` | Current admin |
| `new_admin` | `Address` | Proposed new admin |
| `expires_at` | `u64` | Ledger timestamp after which `accept_admin` will fail |
| `timestamp` | `u64` | Ledger timestamp |

---

### `AdminProposalCancelled`

Emitted when a pending admin proposal is cancelled.

| Field | Type | Description |
|---|---|---|
| `caller` | `Address` | Who cancelled (current admin or operator) |
| `new_admin` | `Address` | Proposed admin that was cancelled |
| `timestamp` | `u64` | Ledger timestamp |

---

### `FeeUpdated`

Emitted when the global, token-level, or escrow-level fee is changed.

| Field | Type | Description |
|---|---|---|
| `scope` | `FeeScope` | `Global`, `Token`, or `Escrow` |
| `has_escrow_id` | `bool` | Whether `escrow_id` is meaningful |
| `escrow_id` | `u64` | Escrow ID (only when `scope == Escrow`) |
| `has_token_address` | `bool` | Whether `token_address` is meaningful |
| `token_address` | `Address` | Token address (only when `scope == Token`) |
| `old_fee_bps` | `i128` | Previous fee in basis points |
| `new_fee_bps` | `i128` | New fee in basis points |
| `timestamp` | `u64` | Ledger timestamp |

---

### `PausedToggled`

Emitted when the circuit breaker is engaged or released.

| Field | Type | Description |
|---|---|---|
| `paused` | `bool` | `true` = contract paused, `false` = resumed |
| `caller` | `Address` | Who toggled the state |
| `caller_role` | `Role` | Role of the caller |
| `timestamp` | `u64` | Ledger timestamp |

---

### `MultisigConfigured`

Emitted when multisig parameters are set on an escrow.

**Emitted by:** `configure_multisig`

---

### `SignatureCollected`

Emitted when a required co-signer submits their signature.

**Emitted by:** `collect_signature`

---

### `ContractUpgraded`

Emitted by `upgrade` before the WASM hash is replaced.

---

## Known Deviations from Convention

| Event | Deviation | Tracking |
|---|---|---|
| `MultisigConfigured` | Payload struct not yet exported in this doc | Add struct definition once finalized |
| `SignatureCollected` | Payload struct not yet exported in this doc | Add struct definition once finalized |

---

## Indexer Guidance

A backend indexer should:

1. Subscribe to the contract's event stream via Horizon or the Stellar RPC `getEvents` endpoint.
2. Filter by `topics[0] == "Vaultix"` to narrow to this contract.
3. Check `topics[1] == "v1"` (or whichever version it supports) and skip unknown versions with a warning.
4. Dispatch on `topics[2]` to the appropriate handler.
5. Deserialize the data payload into the matching struct using the XDR schema for the contract.
