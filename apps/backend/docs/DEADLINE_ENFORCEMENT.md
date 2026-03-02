# Escrow Deadline Enforcement

## Overview

This document describes the deadline enforcement mechanism for escrows, ensuring that escrows cannot remain in limbo indefinitely.

## Lifecycle States

Escrows follow this state machine:

```
PENDING → ACTIVE → COMPLETED
    ↓        ↓         
  EXPIRED  EXPIRED    
    ↓        ↓         
CANCELLED  DISPUTED → EXPIRED
```

### Terminal States
- `COMPLETED`: Escrow successfully released
- `CANCELLED`: Escrow cancelled before completion
- `EXPIRED`: Escrow deadline exceeded

## Deadline Field

Each escrow has an optional `expiresAt` field (DateTime) that defines when the escrow expires.

## Expiration Rules

### Before Deadline
- Normal operations proceed as usual
- Milestone releases and confirmations work normally
- All parties can interact with the escrow

### After Deadline
- No new condition fulfillments or confirmations allowed
- No releases allowed (must use expire endpoint)
- Depositor or arbitrator can trigger expiration

## Expiration Endpoint

### POST `/escrows/:id/expire`

Triggers expiration of an overdue escrow.

**Authorization:**
- Depositor (creator) can expire
- Arbitrator can expire
- Other parties cannot expire

**Validation:**
- Escrow must have an `expiresAt` deadline
- Current time must be past the deadline
- Escrow must not be in a terminal state

**Effect:**
- Sets status to `EXPIRED`
- Logs `EXPIRED` event with metadata
- Dispatches `escrow.expired` webhook
- Prevents further operations

**Request Body:**
```json
{
  "reason": "Optional reason for expiration"
}
```

## Automatic Expiration (Scheduler)

A cron job runs hourly to automatically expire overdue escrows:

### Expired PENDING Escrows
- Status changed to `EXPIRED`
- `isActive` set to false
- Event logged with reason `EXPIRED_PENDING`
- Parties notified via webhook

### Expired ACTIVE Escrows
- Status changed to `EXPIRED`
- Event logged with reason `EXPIRED_ACTIVE`
- Parties notified with `requiresArbitration: true`
- Arbitrator can review and decide on fund distribution

## Invariants

1. **No operations after expiry**: Once expired, no condition fulfillments, confirmations, or releases are allowed
2. **No expiration of terminal states**: Cannot expire COMPLETED, CANCELLED, or already EXPIRED escrows
3. **Deadline required**: Cannot expire an escrow without an `expiresAt` field
4. **Time validation**: Cannot expire before deadline passes

## Events

### EXPIRED Event
```json
{
  "eventType": "expired",
  "data": {
    "reason": "Deadline exceeded",
    "previousStatus": "active",
    "expiresAt": "2024-01-01T00:00:00Z",
    "expiredAt": "2024-01-02T10:30:00Z"
  }
}
```

## Webhooks

### escrow.expired
Dispatched when an escrow is expired (manually or automatically).

```json
{
  "escrowId": "uuid",
  "triggeredBy": "userId"
}
```

## Interaction with Other Features

### Disputes
- Expired ACTIVE escrows can transition to DISPUTED if needed
- Arbitrators can review expired escrows and make decisions
- DISPUTED escrows can also expire if resolution takes too long

### Milestones/Conditions
- Expired escrows block new condition fulfillments
- Already fulfilled conditions remain in their state
- Buyers cannot confirm conditions on expired escrows

### Refunds
- Expiration doesn't automatically refund
- Arbitrator or depositor must initiate refund after expiration
- Refund logic depends on business rules (full refund, partial, etc.)

## Testing

Comprehensive tests cover:
- `test_expire_escrow_refunds_unreleased_amount`: Verifies expiration by depositor
- `test_expire_escrow_after_completion_rejected`: Cannot expire completed escrows
- `test_expire_escrow_before_deadline_rejected`: Cannot expire before deadline
- `test_expire_by_arbitrator`: Arbitrator can trigger expiration
- `test_expire_without_deadline`: Rejects escrows without deadline
- `test_expire_already_expired`: Idempotent expiration handling
- State machine tests for all EXPIRED transitions

## Migration Notes

Existing escrows without `expiresAt` are not affected by expiration logic. They can continue indefinitely unless manually cancelled or completed.
