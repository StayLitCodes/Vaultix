# Data Models & Storage Layout

This document outlines the core data structures and key-value storage layout of the `VaultixEscrow` smart contract.

## Structs & Enums

### `Escrow`
The primary structure detailing a specific escrow transaction.
```rust
pub struct Escrow {
    pub depositor: Address,        // The creator and funder of the escrow
    pub recipient: Address,        // The intended beneficiary
    pub token_address: Address,    // The token being escrowed
    pub total_amount: i128,        // The total amount across all milestones
    pub total_released: i128,      // Amount released so far
    pub milestones: Vec<Milestone>,// List of milestones to complete
    pub status: EscrowStatus,      // Current state of the escrow
    pub deadline: u64,             // Expiration timestamp for refunds
    pub resolution: Resolution,    // Outcome if a dispute occurred
}
```

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
- `("escrow", id: u64)`: (`Escrow`) The main data object for an escrow by ID.
- `("tokfee", token: Address)`: (`i128`) A token-specific fee BPS override.
- `("escfee", escrow_id: u64)`: (`i128`) An escrow-specific fee BPS override.
