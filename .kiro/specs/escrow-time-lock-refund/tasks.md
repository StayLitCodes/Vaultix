# Implementation Plan: Escrow Time-Lock Refund

## Overview

This implementation plan breaks down the time-lock refund mechanism into discrete coding tasks. Each task builds incrementally on previous work, with property-based tests integrated close to implementation to catch errors early. The plan follows the design document and ensures all requirements are met through code.

## Tasks

- [x] 1. Add Expired status and error types to contract
  - Add `Expired` variant to the `EscrowStatus` enum in `apps/onchain/src/lib.rs`
  - Add new error variants to `ContractError`: `DeadlineNotReached`, `InvalidStatusForRefund`, `NoFundsToRefund`, `Unauthorized`
  - Ensure error types implement required traits (Debug, Clone, etc.)
  - _Requirements: 5.1, 8.1, 8.2, 8.3, 8.4_

- [x] 2. Implement core refund_expired function
  - [x] 2.1 Create function signature and basic structure
    - Add `pub fn refund_expired(env: Env, escrow_id: u64) -> Result<(), ContractError>` to contract
    - Implement escrow existence check (load from storage)
    - Return `EscrowNotFound` error if escrow doesn't exist
    - _Requirements: 8.3_
  
  - [x] 2.2 Implement deadline validation
    - Get current timestamp using `env.ledger().timestamp()`
    - Compare current timestamp with `escrow.deadline`
    - Return `DeadlineNotReached` error if `current_time <= deadline`
    - _Requirements: 1.2, 1.3, 8.1_
  
  - [ ]* 2.3 Write property test for deadline enforcement
    - **Property 1: Deadline Expiration Enforcement**
    - **Validates: Requirements 1.2, 1.3, 8.1**
    - Generate random escrows with various deadlines and current times
    - Verify refunds only succeed when current_time > deadline
    - Use quickcheck with minimum 100 iterations
  
  - [x] 2.4 Implement status validation
    - Check that `escrow.status == EscrowStatus::Active`
    - Return `InvalidStatusForRefund` error for any other status
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 8.2_
  
  - [ ]* 2.5 Write property test for status validation
    - **Property 2: Active Status Requirement**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 8.2**
    - Generate escrows with all possible status values
    - Verify only Active escrows can be refunded
    - Test that Disputed, Completed, Cancelled, Created, Resolved all fail

- [x] 3. Implement authorization and balance checks
  - [x] 3.1 Add authorization validation
    - Get caller address from environment
    - Compare caller with `escrow.depositor` (buyer)
    - Return `Unauthorized` error if caller is not the buyer
    - Add configuration option for permissionless mode (optional)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.4_
  
  - [ ]* 3.2 Write property test for authorization
    - **Property 3: Buyer Authorization**
    - **Validates: Requirements 7.1, 7.2, 7.4, 8.4**
    - Generate random caller addresses
    - Verify only buyer can successfully refund
    - Verify unauthorized addresses receive Unauthorized error
  
  - [x] 3.3 Implement remaining balance check
    - Calculate remaining balance: `escrow.amount - escrow.released_amount`
    - Return `NoFundsToRefund` error if remaining balance is zero
    - _Requirements: 9.3_

- [x] 4. Implement fund calculation and transfer logic
  - [x] 4.1 Add fee calculation
    - Retrieve platform fee BPS from contract configuration
    - Calculate platform fee: `(remaining_balance * fee_bps) / 10000`
    - Use checked arithmetic to prevent overflow
    - Calculate refund amount: `remaining_balance - platform_fee`
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [ ]* 4.2 Write property test for fee calculation
    - **Property 6: Fee Calculation Accuracy**
    - **Validates: Requirements 4.2**
    - Generate random amounts and BPS values
    - Verify fee calculation follows formula: (amount * bps) / 10000
    - Test edge cases: zero fees, maximum BPS values
  
  - [x] 4.3 Implement token transfers
    - Get token client for escrow's token address
    - Transfer refund amount to buyer: `token_client.transfer(&contract_address, &escrow.depositor, &refund_amount)`
    - If platform fee > 0, transfer fee to fee recipient
    - Handle transfer errors appropriately
    - _Requirements: 3.2, 3.3, 4.3, 4.4_
  
  - [ ]* 4.4 Write property test for refund amount calculation
    - **Property 4: Refund Amount Calculation**
    - **Validates: Requirements 3.2, 3.3, 4.3**
    - Generate escrows with various amounts and released_amounts
    - Verify buyer receives exactly (amount - released_amount - fee)
    - Test with zero partial releases and various partial releases
  
  - [ ]* 4.5 Write property test for fee recipient transfer
    - **Property 7: Fee Recipient Transfer**
    - **Validates: Requirements 4.4**
    - Generate escrows with various fee amounts
    - Verify fee recipient balance increases by exact fee amount
    - Test with zero fees and non-zero fees

- [x] 5. Implement state updates and event emission
  - [x] 5.1 Update escrow state
    - Set `escrow.status = EscrowStatus::Expired`
    - Set `escrow.released_amount = escrow.amount` (mark all funds as released)
    - Save updated escrow to storage: `storage.set(&(ESCROW, escrow_id), &escrow)`
    - Extend TTL for escrow storage entry
    - _Requirements: 5.1, 5.3, 3.5_
  
  - [ ]* 5.2 Write property test for status update
    - **Property 8: Status Update to Expired**
    - **Validates: Requirements 5.1, 5.3**
    - Generate random escrows
    - After successful refund, verify status is Expired
    - Verify status persists when reading from storage
  
  - [ ]* 5.3 Write property test for balance zeroing
    - **Property 5: Balance Zeroing**
    - **Validates: Requirements 3.5**
    - Generate escrows with various balances
    - After refund, verify remaining balance is zero
    - Verify released_amount equals original amount
  
  - [x] 5.4 Define and emit RefundEvent
    - Define `RefundEvent` struct with fields: escrow_id, buyer, amount, timestamp
    - Emit event using `env.events().publish()`
    - Include all required fields in event
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [ ]* 5.5 Write property test for event emission
    - **Property 9: Refund Event Emission**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**
    - Generate random escrows
    - After refund, verify RefundEvent was emitted
    - Verify event contains correct escrow_id, buyer, amount, timestamp

- [x] 6. Checkpoint - Ensure core functionality works
  - Run all tests to verify refund_expired function works correctly
  - Test successful refund scenarios manually in test environment
  - Verify all validation checks work as expected
  - Ask the user if questions arise

- [x] 7. Write comprehensive unit tests
  - [ ]* 7.1 Write unit test for successful refund (no partial releases)
    - Create escrow with deadline in past
    - Call refund_expired as buyer
    - Verify funds transferred to buyer
    - Verify status updated to Expired
    - Verify event emitted
    - _Requirements: 1.2, 2.1, 3.2, 5.1, 6.1_
  
  - [ ]* 7.2 Write unit test for successful refund with partial releases
    - Create escrow with some milestones already released
    - Fast-forward past deadline
    - Call refund_expired
    - Verify only remaining balance refunded
    - _Requirements: 3.3, 9.1, 9.2_
  
  - [ ]* 7.3 Write unit test for refund rejection before deadline
    - Create escrow with deadline in future
    - Attempt refund_expired
    - Verify DeadlineNotReached error returned
    - Verify no state changes occurred
    - _Requirements: 1.3, 8.1_
  
  - [ ]* 7.4 Write unit tests for invalid status rejection
    - Create escrows in Disputed, Completed, Cancelled statuses
    - Attempt refund_expired on each
    - Verify InvalidStatusForRefund error for all
    - _Requirements: 2.2, 2.3, 2.4, 8.2_
  
  - [ ]* 7.5 Write unit test for unauthorized caller rejection
    - Create escrow past deadline
    - Call refund_expired from non-buyer address
    - Verify Unauthorized error returned
    - _Requirements: 7.1, 7.4, 8.4_
  
  - [ ]* 7.6 Write unit test for non-existent escrow
    - Call refund_expired with invalid escrow_id
    - Verify appropriate error returned
    - _Requirements: 8.3_
  
  - [ ]* 7.7 Write unit test for zero remaining balance
    - Create escrow with all funds already released
    - Fast-forward past deadline
    - Attempt refund_expired
    - Verify NoFundsToRefund error returned
    - _Requirements: 9.3_
  
  - [ ]* 7.8 Write unit test for fee calculation edge cases
    - Test with zero fee BPS
    - Test with maximum fee BPS
    - Test with very small amounts
    - Verify correct fee deduction in all cases
    - _Requirements: 4.2_

- [ ] 8. Write integration tests
  - [ ]* 8.1 Write end-to-end escrow lifecycle test with expiration
    - Create escrow
    - Activate escrow
    - Fast-forward past deadline without seller action
    - Buyer calls refund_expired
    - Verify complete flow works correctly
    - _Requirements: All_
  
  - [ ]* 8.2 Write test for dispute preventing refund
    - Create active escrow past deadline
    - Raise dispute on escrow
    - Attempt refund_expired
    - Verify refund rejected due to Disputed status
    - _Requirements: 2.2, 2.5_
  
  - [ ]* 8.3 Write test for multiple escrows with different deadlines
    - Create multiple escrows with staggered deadlines
    - Fast-forward time incrementally
    - Refund each escrow as it expires
    - Verify each refund processes independently
    - _Requirements: All_

- [ ]* 9. Write property test for non-existent escrow handling
  - **Property 10: Non-Existent Escrow Handling**
  - **Validates: Requirements 8.3**
  - Generate random escrow IDs that don't exist
  - Verify all return appropriate error
  - Test with various ID values (0, max, random)

- [x] 10. Final checkpoint and documentation
  - Run complete test suite (unit + property tests)
  - Verify all 10 correctness properties pass
  - Ensure test coverage meets goals
  - Add inline code comments for complex logic
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness across all inputs (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- Integration tests verify cross-component interactions
- Mock ledger timestamp using `env.le
running 6 tests
test test::test_refund_expired_successful_basic ...dger().set_timestamp()` in tests
- Use quickcheck crate for property-based testing in Rust
- All tests should use Soroban SDK test utilities
