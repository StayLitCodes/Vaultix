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

If a disagreement arises, either party can raise a dispute, locking the escrow until the Arbitrator steps in.

```mermaid
sequenceDiagram
    participant U as Depositor/Recipient
    participant C as VaultixEscrow
    participant A as Arbitrator
    participant T as Tokens

    U->>C: raise_dispute(id)
    Note over C: Status: Disputed
    
    A->>C: resolve_dispute(id, winner, split)
    C->>T: transfer(winner_amount to Winner)
    C->>T: transfer(other_amount to Other)
    Note over C: Status: Resolved
```
