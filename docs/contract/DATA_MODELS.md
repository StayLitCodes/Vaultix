# Data Models & Storage Layout

This document outlines the core data structures and key-value storage layout of the `VaultixEscrow` smart contract.

## Structs & Enums

### `Escrow`
The primary structure returned by public query entrypoints.
```rust
pub struct Escrow {
    pub depositor: Address,
    pub recipient: Address,
    pub token_address: Address,
    pub total_amount: i128,
    pub total_released: i128,
    pub milestones: Vec<Milestone>,
    pub status: EscrowStatus,
    pub deadline: u64,
    pub resolution: Resolution,
    pub threshold_amount: i128,
    pub required_signatures: u32,
    pub collected_signatures: Vec<Address>,
    pub metadata_hash: BytesN<32>,
}
```

### `EscrowEntryV2`
The internal persisted representation for the current escrow storage layout.
- Stored under `("esc2", escrow_id)` as `EscrowEntryV2`.
- Includes the packed escrow state, fee override metadata, and all fields required for migration.
- When a legacy `Escrow` entry exists under `("escrow", escrow_id)`, the contract migrates it lazily on first access.
- A companion version marker is stored under `("escver", escrow_id)` as a `u8`.

```rust
struct EscrowEntryV2 {
    depositor: Address,
    recipient: Address,
    token_address: Address,
    total_amount: i128,
    total_released: i128,
    milestones: Vec<Milestone>,
    packed_state: u32,
    deadline: u64,
    threshold_amount: i128,
    required_signatures: u32,
    collected_signatures: Vec<Address>,
    fee_override_bps: i128,
    metadata_hash: BytesN<32>,
}
```

### `metadata_hash` Canonical Format
- On-chain `metadata_hash` is exactly 32 raw bytes.
- Off-chain clients should represent the same value as lowercase 64-character hex.
- The canonical bytes are the SHA-256 digest bytes, not the CID string bytes.
- For IPFS references, clients should decode the CID multihash and extract the 32-byte `sha2-256` digest.
- The all-zero digest is rejected as malformed input.

### IPFS / CID Strategy
- Preferred display form: `ipfs://<cid>`.
- Preferred write path: CIDv1 base32 using `sha2-256`.
- Interop rule: backend/frontend normalize either a raw 32-byte hex digest or an IPFS CID into the same lowercase 64-character hex string, then pass those bytes on-chain.
- Determinism requirement: the metadata payload must be serialized identically before upload; otherwise a new CID and digest will be produced.

### `Milestone`
Represents an individual chunk of the total payout.
```rust
pub struct Milestone {
    pub amount: i128,              // The payout amount for this milestone
    pub status: MilestoneStatus,   // Pending, Released, or Disputed
    pub description: Symbol,       // Short description or identifier
}
```

### `EscrowStatus`
Enumerates all the potential states an `Escrow` can be in:
- `Created`: Initialized but unfunded.
- `Active`: Funded and active.
- `Completed`: All milestones released.
- `Cancelled`: Terminated early, funds refunded.
- `Disputed`: Frozen due to a dispute.
- `Resolved`: Settlement reached via arbitration.
- `Expired`: Deadline passed, funds refunded to depositor.

### `ContractState`
Used to pause the contract's standard workflows.
- `Active`: Contract functioning normally.
- `Paused`: Circuit breaker engaged; deposits/releases halted.

---

## Storage Layout
The contract utilizes both `Instance` and `Persistent` storage on Soroban.

### Instance Storage
Holds global configuration data required frequently.
- `treasury` (`Symbol`): (`Address`) The fee collection address.
- `fee_bps` (`Symbol`): (`i128`) The global default fee in basis points.
- `state` (`Symbol`): (`ContractState`) Current operational state (Active/Paused).

### Persistent Storage
Holds longer-term state, retaining data specifically for individual escrows and specific roles.
- `admin` (`Symbol`): (`Address`) The contract admin.
- `operator` (`Symbol`): (`Address`) The emergency operator.
- `arbitrator` (`Symbol`): (`Address`) The dispute resolution arbitrator.
- `("escrow", id: u64)`: (`Escrow`) Legacy escrow record format, migrated on access.
- `("esc2", id: u64)`: (`EscrowEntryV2`) Current escrow record format with packed state and fee override metadata.
- `("escver", id: u64)`: (`u8`) Explicit V2 escrow version marker companion value.
- `("tokfee", token: Address)`: (`i128`) A token-specific fee BPS override.
- `("escfee", escrow_id: u64)`: (`i128`) An escrow-specific fee BPS override.
