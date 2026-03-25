# Requirements Document

## Introduction

This document specifies the requirements for implementing a time-lock mechanism with automatic refund functionality in the Vaultix escrow smart contract. The feature protects buyers from unresponsive sellers by allowing fund recovery after a deadline expires, while respecting the existing dispute resolution and milestone release mechanisms.

## Glossary

- **Escrow_Contract**: The Soroban smart contract managing escrow transactions on Stellar
- **Buyer**: The party depositing funds into escrow (also called depositor)
- **Seller**: The party receiving funds upon milestone completion
- **Deadline**: A Unix timestamp (u64) representing when the escrow expires
- **Ledger_Timestamp**: The current blockchain time obtained via `env.ledger().timestamp()`
- **Active_Escrow**: An escrow in the Active status (not Disputed, Completed, or Cancelled)
- **Refund_Function**: The new `refund_expired` function that processes expired escrows
- **Platform_Fee**: A fee charged by the platform, calculated in basis points (BPS)
- **TTL**: Time-to-live for persistent storage entries in Soroban

## Requirements

### Requirement 1: Deadline Expiration Detection

**User Story:** As a buyer, I want the system to detect when an escrow deadline has passed, so that I can reclaim my funds if the seller becomes unresponsive.

#### Acceptance Criteria

1. WHEN the Refund_Function is called, THE Escrow_Contract SHALL retrieve the current Ledger_Timestamp
2. WHEN comparing timestamps, THE Escrow_Contract SHALL verify that Ledger_Timestamp is greater than the escrow's Deadline
3. IF Ledger_Timestamp is less than or equal to Deadline, THEN THE Escrow_Contract SHALL reject the refund request with an appropriate error
4. THE Escrow_Contract SHALL use the existing `deadline` field from the Escrow struct for comparison

### Requirement 2: Refund Eligibility Validation

**User Story:** As a system administrator, I want refunds to only process for eligible escrows, so that the contract maintains integrity and prevents unauthorized fund transfers.

#### Acceptance Criteria

1. WHEN the Refund_Function is called, THE Escrow_Contract SHALL verify the escrow status is Active
2. IF the escrow status is Disputed, THEN THE Escrow_Contract SHALL reject the refund request
3. IF the escrow status is Completed, THEN THE Escrow_Contract SHALL reject the refund request
4. IF the escrow status is Cancelled, THEN THE Escrow_Contract SHALL reject the refund request
5. WHEN the escrow has an active dispute, THE Escrow_Contract SHALL prevent expiration-based refunds

### Requirement 3: Fund Transfer Execution

**User Story:** As a buyer, I want to receive my remaining escrowed funds when the deadline expires, so that I can recover my investment from an unresponsive transaction.

#### Acceptance Criteria

1. WHEN a valid refund is processed, THE Escrow_Contract SHALL calculate the remaining fund balance in the escrow
2. WHEN transferring funds, THE Escrow_Contract SHALL send the remaining balance to the Buyer's address
3. WHEN partial milestone releases have occurred, THE Escrow_Contract SHALL only refund the unreleased portion
4. THE Escrow_Contract SHALL use the Soroban token transfer mechanism for fund movement
5. WHEN the transfer completes, THE Escrow_Contract SHALL update the escrow's fund balance to zero

### Requirement 4: Platform Fee Handling

**User Story:** As a platform operator, I want clear fee policies for expired refunds, so that the business model remains sustainable while being fair to users.

#### Acceptance Criteria

1. WHEN processing an expired refund, THE Escrow_Contract SHALL determine whether to charge a Platform_Fee
2. IF a Platform_Fee is charged, THE Escrow_Contract SHALL calculate the fee using the existing basis points (BPS) mechanism
3. IF a Platform_Fee is charged, THE Escrow_Contract SHALL deduct the fee before transferring funds to the Buyer
4. THE Escrow_Contract SHALL transfer any collected fees to the platform fee recipient address

### Requirement 5: Escrow Status Update

**User Story:** As a system auditor, I want expired escrows to have a distinct status, so that I can track and analyze refund patterns and contract usage.

#### Acceptance Criteria

1. WHEN a refund is successfully processed, THE Escrow_Contract SHALL update the escrow status to a new terminal state
2. THE Escrow_Contract SHALL support either "Refunded" or "Expired" as the new status value
3. WHEN the status is updated, THE Escrow_Contract SHALL persist the change to contract storage
4. THE Escrow_Contract SHALL extend the TTL for the updated escrow data

### Requirement 6: Event Emission

**User Story:** As an off-chain monitoring system, I want events emitted for refund operations, so that I can track escrow lifecycle events and notify relevant parties.

#### Acceptance Criteria

1. WHEN a refund is successfully processed, THE Escrow_Contract SHALL emit a refund event
2. THE refund event SHALL include the escrow identifier
3. THE refund event SHALL include the Buyer's address
4. THE refund event SHALL include the refunded amount
5. THE refund event SHALL include the timestamp of the refund operation

### Requirement 7: Access Control

**User Story:** As a security-conscious developer, I want refund operations to have proper access controls, so that only authorized parties can trigger refunds.

#### Acceptance Criteria

1. WHEN the Refund_Function is called, THE Escrow_Contract SHALL verify the caller is authorized
2. THE Escrow_Contract SHALL allow the Buyer to call the Refund_Function
3. WHERE the contract supports permissionless refunds, THE Escrow_Contract SHALL allow any address to trigger an expired refund
4. WHEN authorization fails, THE Escrow_Contract SHALL reject the request with an appropriate error

### Requirement 8: Error Handling

**User Story:** As a contract user, I want clear error messages when refund operations fail, so that I can understand why my transaction was rejected and take appropriate action.

#### Acceptance Criteria

1. WHEN the deadline has not passed, THE Escrow_Contract SHALL return an error indicating the escrow is not yet expired
2. WHEN the escrow status is invalid, THE Escrow_Contract SHALL return an error indicating the current status
3. WHEN the escrow does not exist, THE Escrow_Contract SHALL return an error indicating invalid escrow ID
4. WHEN authorization fails, THE Escrow_Contract SHALL return an error indicating unauthorized access
5. WHEN fund transfer fails, THE Escrow_Contract SHALL return an error and maintain contract state consistency

### Requirement 9: Partial Release Compatibility

**User Story:** As a buyer, I want refunds to work correctly even after partial milestone releases, so that I can recover any remaining funds after the deadline expires.

#### Acceptance Criteria

1. WHEN milestone releases have occurred before expiration, THE Escrow_Contract SHALL track the remaining balance accurately
2. WHEN calculating refund amounts, THE Escrow_Contract SHALL account for all previous releases
3. IF all funds have been released through milestones, THEN THE Escrow_Contract SHALL reject the refund request
4. THE Escrow_Contract SHALL maintain accurate balance records throughout the escrow lifecycle

### Requirement 10: Storage and State Management

**User Story:** As a contract maintainer, I want proper storage management for refund operations, so that the contract remains efficient and complies with Soroban storage requirements.

#### Acceptance Criteria

1. WHEN updating escrow state, THE Escrow_Contract SHALL persist changes to the appropriate storage type
2. WHEN accessing escrow data, THE Escrow_Contract SHALL extend TTL as needed
3. THE Escrow_Contract SHALL use persistent storage for escrow records
4. WHEN the refund completes, THE Escrow_Contract SHALL ensure all state changes are atomic
