# Consistency Checker

## Overview

The Consistency Checker is an automated system that verifies database state matches on-chain state for escrows. It detects discrepancies caused by failed transactions, missed webhooks, or manual database edits.

## Features

### 1. Automated Scheduled Checks
- **Daily Check**: Runs at 2 AM daily, checking all ACTIVE escrows
- **Stale Escrow Check**: Runs hourly, checking escrows with no updates in 24h

### 2. On-Chain Verification
For each escrow, the system:
- Queries Stellar network for escrow account state via Soroban
- Compares: amount, asset, parties, status
- Flags discrepancies with severity levels

### 3. Severity Levels
- **CRITICAL**: Status mismatch, amount mismatch
- **WARNING**: Missing events, stale timestamps, party mismatches
- **INFO**: Minor inconsistencies

### 4. Admin Notifications
Critical discrepancies trigger admin alerts (logged for MVP, extensible to email/Slack).

## API Endpoints

### POST /admin/consistency/check
Manual consistency check for specific escrows.

**Request:**
```json
{
  "escrowIds": ["escrow-1", "escrow-2"]
}
```
or
```json
{
  "fromId": 1,
  "toId": 50
}
```

**Response:**
```json
{
  "reports": [
    {
      "escrowId": 1,
      "isConsistent": false,
      "fieldsMismatched": [
        {
          "fieldName": "status",
          "dbValue": "active",
          "onchainValue": "Completed"
        }
      ]
    }
  ],
  "summary": {
    "totalChecked": 2,
    "totalInconsistent": 1,
    "totalMissingInDb": 0,
    "totalMissingOnChain": 0,
    "totalErrored": 0
  }
}
```

### GET /admin/consistency/reports
List recent consistency check results.

**Query Parameters:**
- `severity`: Filter by severity (critical, warning, info)
- `resolved`: Filter by resolution status (true/false)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)

**Response:**
```json
{
  "data": [
    {
      "id": "report-uuid",
      "escrowId": "escrow-1",
      "severity": "critical",
      "discrepancies": [
        {
          "field": "status",
          "dbValue": "active",
          "onchainValue": "Completed"
        }
      ],
      "resolved": false,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 5
}
```

### GET /admin/consistency/:escrowId
Detailed comparison for a specific escrow.

**Response:**
```json
{
  "escrowId": "escrow-1",
  "database": {
    "id": "escrow-1",
    "status": "active",
    "amount": 100,
    "assetCode": "XLM",
    "creatorId": "user-1",
    "updatedAt": "2024-01-15T10:00:00Z"
  },
  "onchain": {
    "status": "Completed",
    "amount": "100",
    "depositor": "user-1",
    "recipient": "user-2"
  },
  "discrepancies": [
    {
      "fieldName": "status",
      "dbValue": "active",
      "onchainValue": "Completed"
    }
  ]
}
```

### POST /admin/consistency/resolve
Force-sync database state with on-chain state.

**Request:**
```json
{
  "escrowId": "escrow-1",
  "adminUserId": "admin-user-id",
  "syncToOnchain": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Discrepancy resolved"
}
```

## Database Schema

### ConsistencyReport Entity
```typescript
{
  id: string;                    // UUID
  escrowId: string;              // Reference to escrow
  severity: ConsistencySeverity; // critical | warning | info
  discrepancies: Array<{
    field: string;
    dbValue: unknown;
    onchainValue: unknown;
  }>;
  metadata?: Record<string, unknown>;
  resolved: boolean;
  resolvedByUserId?: string;
  resolvedAt?: Date;
  createdAt: Date;
}
```

## Cron Jobs

### Daily Consistency Check
- **Schedule**: Every day at 2 AM
- **Target**: All ACTIVE escrows
- **Action**: Compare DB vs on-chain, save reports

### Stale Escrow Check
- **Schedule**: Every hour
- **Target**: ACTIVE escrows with no update in 24h
- **Action**: Immediate consistency verification

## Usage Examples

### Manual Check via API
```bash
curl -X POST http://localhost:3000/admin/consistency/check \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"escrowIds": ["escrow-1", "escrow-2"]}'
```

### View Reports
```bash
curl -X GET "http://localhost:3000/admin/consistency/reports?severity=critical&resolved=false" \
  -H "Authorization: Bearer <admin-token>"
```

### Resolve Discrepancy
```bash
curl -X POST http://localhost:3000/admin/consistency/resolve \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "escrowId": "escrow-1",
    "adminUserId": "admin-123",
    "syncToOnchain": true
  }'
```

## Testing

Run E2E tests:
```bash
cd apps/backend
npm run test:e2e -- consistency-checker.e2e-spec.ts
```

## Future Enhancements
- Email/Slack notifications for critical discrepancies
- Auto-resolution for specific discrepancy types
- Detailed audit trail for all resolutions
- Dashboard visualization of consistency metrics
