# Escrow Expiration Usage Examples

## Creating an Escrow with Deadline

```typescript
POST /escrows
{
  "title": "Freelance Project Payment",
  "amount": 1000,
  "asset": "XLM",
  "expiresAt": "2024-12-31T23:59:59Z",
  "parties": [
    { "userId": "seller-123", "role": "seller" },
    { "userId": "arbitrator-456", "role": "arbitrator" }
  ],
  "conditions": [
    { "description": "Project delivered", "type": "manual" }
  ]
}
```

## Scenario 1: Normal Completion Before Deadline

1. Seller fulfills condition
2. Buyer confirms condition
3. Escrow auto-releases
4. Status: `COMPLETED`

## Scenario 2: Deadline Exceeded - Depositor Triggers Expiration

```typescript
// Current time: 2025-01-05 (past deadline)
POST /escrows/escrow-123/expire
Authorization: Bearer <depositor-token>
{
  "reason": "Seller became unresponsive"
}

// Response
{
  "id": "escrow-123",
  "status": "expired",
  "expiresAt": "2024-12-31T23:59:59Z",
  ...
}
```

## Scenario 3: Automatic Expiration by Scheduler

```
Cron runs hourly:
- Finds escrow-456 with expiresAt: 2024-12-31
- Current time: 2025-01-01 02:00
- Automatically sets status to EXPIRED
- Sends notifications to all parties
```

## Scenario 4: Arbitrator Intervention

```typescript
// Escrow expired while ACTIVE
// Arbitrator reviews and decides

POST /escrows/escrow-789/expire
Authorization: Bearer <arbitrator-token>
{
  "reason": "Deadline exceeded, reviewing for resolution"
}

// Arbitrator can then:
// - Issue refund to depositor
// - Release funds to seller if work was done
// - Split funds based on partial completion
```

## Scenario 5: Attempting Operations After Expiration

```typescript
// Trying to fulfill condition after expiration
POST /escrows/escrow-123/conditions/cond-1/fulfill
{
  "notes": "Work completed"
}

// Response: 400 Bad Request
{
  "statusCode": 400,
  "message": "Cannot fulfill conditions on an expired escrow"
}
```

## Scenario 6: Checking Expiration Status

```typescript
GET /escrows/escrow-123

// Response
{
  "id": "escrow-123",
  "status": "expired",
  "expiresAt": "2024-12-31T23:59:59Z",
  "events": [
    {
      "eventType": "expired",
      "data": {
        "reason": "EXPIRED_ACTIVE",
        "expiredAt": "2025-01-01T02:00:00Z"
      }
    }
  ]
}
```

## Error Cases

### Expire Before Deadline
```typescript
POST /escrows/escrow-123/expire

// Response: 400 Bad Request
{
  "message": "Escrow has not expired yet. Expires at: 2024-12-31T23:59:59Z"
}
```

### Expire Without Deadline
```typescript
POST /escrows/escrow-456/expire

// Response: 400 Bad Request
{
  "message": "Escrow has no expiration deadline"
}
```

### Unauthorized Expiration
```typescript
POST /escrows/escrow-123/expire
Authorization: Bearer <seller-token>

// Response: 403 Forbidden
{
  "message": "Only the depositor or arbitrator can expire an escrow"
}
```

### Expire Completed Escrow
```typescript
POST /escrows/escrow-789/expire

// Response: 400 Bad Request
{
  "message": "Cannot expire an escrow that is already completed"
}
```
