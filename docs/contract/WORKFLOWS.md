# Contract Workflows

This document visualizes the major workflows of the `VaultixEscrow` contract.

## 1. Happy Path

The intended scenario where both parties fulfill their obligations without disputes.

```mermaid
sequenceDiagram
    participant D as Depositor
    participant C as VaultixEscrow
    participant T as Token/Treasury
    participant R as Recipient

    D->>C: create_escrow(id, target, tokens, milestones)
    Note over C: Status: Created
    D->>C: deposit_funds(id)
    C->>T: transfer_from(Depositor to Contract)
    Note over C: Status: Active
    
    loop Per Milestone
        D->>C: release_milestone(id, index)
        C->>T: transfer(payout to Recipient)
        C->>T: transfer(fee to Treasury)
        Note over C: Milestone Status: Released
    end
    
    D->>C: complete_escrow(id)
    Note over C: Status: Completed
```

## 2. Cancellation

An escrow can be canceled prior to any funds being released, resulting in a refund minus any configured fees.

```mermaid
sequenceDiagram
    participant D as Depositor
    participant C as VaultixEscrow
    participant T as Token/Treasury

    D->>C: cancel_escrow(id)
    Note over C: Must be Active/Created & total_released == 0
    C->>T: transfer(fee to Treasury)
    C->>T: transfer(refund to Depositor)
    Note over C: Status: Cancelled
```

## 3. Emergency Pause (Circuit Breaker)

The Operator can pause the core functions of the contract to halt potential exploits or logic errors.

```mermaid
sequenceDiagram
    participant O as Operator
    participant C as VaultixEscrow
    participant U as Users (Depositor/Recipient)

    O->>C: set_paused(true)
    Note over C: ContractState::Paused
    
    U--xC: create_escrow() (Blocked)
    U--xC: deposit_funds() (Blocked)
    U--xC: release_milestone() (Blocked)
    U--xC: raise_dispute() (Blocked)
    U--xC: cancel_escrow() (Blocked)
    
    Note over C: Arbitrator and expiration refunds<br/>are preserved so resolution can occur.
```

## 4. Dispute Resolution

If a disagreement arises, either party can raise a dispute, locking the escrow until the Arbitrator steps in. Raising a dispute requires an `evidence_hash` anchoring the off-chain evidence; the Arbitrator may optionally anchor its own `resolution_evidence_hash` with the ruling. See "Dispute Evidence Hash Interop" in `README.md` for the digest convention.

```mermaid
sequenceDiagram
    participant U as Depositor/Recipient
    participant C as VaultixEscrow
    participant A as Arbitrator
    participant T as Tokens

    U->>C: raise_dispute(id, evidence_hash)
    Note over C: Status: Disputed
    
    A->>C: resolve_dispute(id, winner, split, resolution_evidence_hash?)
    C->>T: transfer(winner_amount to Winner)
    C->>T: transfer(other_amount to Other)
    Note over C: Status: Resolved
```

## 5. Admin Transfer (Two-Step)

A single `set_admin` typo used to permanently lock out contract governance. The
admin role now changes only through a propose/accept handshake: the current
admin stages a pending proposal, and only the pending admin — by authenticating
as themselves — can complete the transfer. A pending proposal expires after
`ADMIN_PROPOSAL_WINDOW_SECS` (7 days); the current admin can withdraw it at any
time with `cancel_admin_proposal`.

```mermaid
sequenceDiagram
    participant A as Current Admin
    participant C as VaultixEscrow
    participant N as New Admin

    A->>C: propose_admin(new_admin)
    Note over C: Stores pending proposal + expiry window<br/>Admin role unchanged
    A->>C: cancel_admin_proposal() (optional)
    Note over C: Withdraws the pending proposal<br/>Admin role unchanged
    N->>C: accept_admin()
    Note over C: Requires auth from pending admin<br/>Emits RoleUpdated(Admin, old → new)
    Note over C: Admin role transferred
```
