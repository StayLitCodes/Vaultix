# Quick Reference: Escrow Expiration

## Status Flow
```
PENDING/ACTIVE/DISPUTED → EXPIRED (terminal)
```

## API Endpoint
```
POST /escrows/:id/expire
Body: { "reason": "optional" }
Auth: Depositor or Arbitrator only
```

## Validation Rules
- ✅ Must have `expiresAt` deadline
- ✅ Current time > `expiresAt`
- ✅ Not in terminal state (COMPLETED, CANCELLED, EXPIRED)
- ✅ User is depositor or arbitrator

## Automatic Expiration
- Runs: Every hour (cron)
- PENDING → EXPIRED
- ACTIVE → EXPIRED

## Blocked Operations After Expiry
- ❌ Fulfill conditions
- ❌ Confirm conditions
- ❌ Release escrow
- ✅ View escrow details
- ✅ View events

## Event Emitted
```json
{
  "eventType": "expired",
  "data": {
    "reason": "string",
    "previousStatus": "active|pending|disputed",
    "expiresAt": "ISO8601",
    "expiredAt": "ISO8601"
  }
}
```

## Webhook
```
escrow.expired
{ "escrowId": "uuid", "triggeredBy": "userId" }
```

## Error Messages
- "Cannot expire an escrow that is already {status}"
- "Escrow has no expiration deadline"
- "Escrow has not expired yet. Expires at: {date}"
- "Only the depositor or arbitrator can expire an escrow"
- "Cannot {operation} on an expired escrow"

## Code Examples

### Check if Expired
```typescript
if (escrow.status === EscrowStatus.EXPIRED) {
  // Handle expired state
}
```

### Expire Escrow
```typescript
await escrowService.expire(
  escrowId,
  { reason: 'Deadline exceeded' },
  userId,
  ipAddress
);
```

### Guard Against Expiry
```typescript
if (escrow.expiresAt && escrow.expiresAt < new Date()) {
  throw new BadRequestException('Cannot operate on expired escrow');
}
```
