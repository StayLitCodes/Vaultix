# Error Reference

Below is a complete reference of the `Error` enum variants returned by the `VaultixEscrow` contract, detailing what causes them and how to mitigate them.

| Error | Code | Explanation | Fix / Mitigation |
|-------|------|-------------|------------------|
| `EscrowNotFound` | 1 | No escrow matching the provided ID exists in storage. | Double-check the ID or verify that `create_escrow` fired successfully. |
| `EscrowAlreadyExists` | 2 | An escrow with that ID has already been created. | Use a unique ID (e.g., an incrementing counter or UUID). |
| `MilestoneNotFound` | 3 | Provided milestone index exceeds `milestones.len()`. | Check the total number of milestones. Keep in mind it's zero-indexed. |
| `MilestoneAlreadyReleased` | 4 | Attempted to release a milestone that was already released. | Ensure you're not double-calling the release function. |
| `UnauthorizedAccess` | 5 | Caller is not the depositor/recipient but attempted sensitive action. | Ensure the caller matches the required authorization logic for the function. |
| `InvalidMilestoneAmount` | 6 | Checked math error indicating underflow, overflow, or mismatch. | Verify milestone amounts are > 0 and fee calculations match expectations. |
| `TotalAmountMismatch` | 7 | Reserved for logic detecting an amount that doesn't align. | Ensure the sum of milestones equals `total_amount`. |
| `InsufficientBalance` | 8 | Depositor lacks necessary token balance during funding or transfers. | Fund the depositor's wallet before depositing. |
| `EscrowNotActive` | 9 | Escrow state is not Active (e.g., Created, Completed, Cancelled). | Check `EscrowStatus` before calling execution functions. |
| `VectorTooLarge` | 10 | The provided milestone list exceeds maximum limit (20). | Create an escrow with 20 or fewer milestones. |
| `ZeroAmount` | 11 | A milestone was supplied with an amount of exactly 0. | All milestones must have an amount > 0. |
| `InvalidDeadline` | 12 | The deadline provided is invalid or in the past. | Supply a valid future `u64` timestamp. |
| `SelfDealing` | 13 | The depositor address perfectly matches the recipient address. | Designate a different address for the recipient. |
| `EscrowAlreadyFunded` | 14 | Attempted to `deposit_funds` when state is not `Created`. | Prevent calling `deposit_funds` more than once per escrow. |
| `TokenTransferFailed` | 15 | Token `allowance` to the contract is insufficient. | Have depositor call `approve()` on the token contract for the escrow address first. |
| `TreasuryNotInitialized` | 16 | Missing `treasury` in instance storage. | Admin must call `initialize()` before complex fee flows can occur. |
| `InvalidFeeConfiguration` | 17 | Provided fee BPS is outside `0` to `10000` (100%). | Pass a valid fee BPS config. |
| `AdminNotInitialized` | 18 | `admin` address is missing in persistent storage. | `init()` must be the first function called on a fresh deployment. |
| `AlreadyInitialized` | 19 | `init()` was called, but the contract is already initialized. | Intended behavior; prevents hostile takeover. |
| `InvalidEscrowStatus` | 20 | Tried to complete/cancel but state was already cancelled/completed. | Validate state via `get_state()` before actioning. |
| `AlreadyInDispute` | 21 | Attempted to raise a dispute on an already disputed escrow. | Intended behavior; wait for Arbitrator. |
| `InvalidWinner` | 22 | Arbitrator named a winner that is not depositor or recipient. | The winner must be mapped to the original parties. |
| `ContractPaused` | 23 | Operator has invoked Emergency Pause; normal ops suspended. | Wait for the Operator to `set_paused(false)`. |
| `DeadlineNotReached` | 24 | Attempting `refund_expired` before `deadline` passed. | Wait until timestamp is `> deadline`. |
| `InvalidStatusForRefund` | 25 | Escrow is disputed or has a non-Active state during an expiration refund attempt. | You can only expire/refund an `Active` escrow. |
| `NoFundsToRefund` | 26 | Expiration refund triggered, but `remaining_balance` is zero. | Nothing to refund; ignore. |
| `Unauthorized` | 27 | Similar to (5), unauthorized function caller specifically for expiration refund. | Check who you are logging in with. |
| `OperatorNotInitialized` | 28 | `operator` address missing in persistent storage. | Contact Admin to supply this config. |
| `ArbitratorNotInitialized` | 29 | `arbitrator` address missing in persistent storage. | Contact Admin to supply this config. |
