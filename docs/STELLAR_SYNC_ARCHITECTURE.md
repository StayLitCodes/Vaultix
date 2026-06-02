# Vaultix: Stellar-PostgreSQL Synchronization Architecture

## Overview

Vaultix maintains data consistency between the Stellar blockchain (Soroban smart contract) and the PostgreSQL database through a dual-layer synchronization architecture:

1. **Real-time Event Listening** - `StellarEventListenerService` processes blockchain events as they occur
2. **Consistency Verification** - `ConsistencyCheckerService` detects and reports discrepancies

This document explains the event processing pipeline, re-syncing strategies, and database schema mapping.

---

## 1. StellarEventListenerService - Real-time Event Processing

### Purpose
The `StellarEventListenerService` continuously monitors the Stellar ledger for events emitted by the Vaultix Soroban smart contract and synchronizes them to the PostgreSQL database in real-time.

### Location
```
apps/backend/src/modules/stellar/services/stellar-event-listener.service.ts
```

### Event Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EVENT PROCESSING PIPELINE                           │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐
  │ 1. Initialize│ ← On module init, starts listener automatically
  └──────┬───────┘
         │
         ▼
  ┌──────────────────────────────┐
  │ 2. Get Last Processed Ledger │ ← Query stellar_events table for highest
  │    (Recovery Point)          │    ledger number to resume from
  └──────┬───────────────────────┘
         │
         ▼
  ┌──────────────────────────────┐
  │ 3. Poll Latest Ledger        │ ← Query Stellar RPC for current ledger
  │    (Every 10 seconds)        │    sequence number
  └──────┬───────────────────────┘
         │
         ▼
  ┌──────────────────────────────┐
  │ 4. Fetch Events for Range    │ ← Call server.getEvents() with contract
  │    [lastProcessed+1, latest] │    filter to get contract-specific events
  └──────┬───────────────────────┘
         │
         ▼
  ┌──────────────────────────────┐
  │ 5. Process Each Event        │ ← For each event in range:
  │                              │    a. Check idempotency (txHash + eventIndex)
  │                              │    b. Normalize event (parse XDR, extract fields)
  │                              │    c. Save to stellar_events table
  │                              │    d. Update escrow record in escrows table
  └──────┬───────────────────────┘
         │
         ▼
  ┌──────────────────────────────┐
  │ 6. Update Tracking           │ ← Set lastProcessedLedger = latest
  │                              │    Sleep 10s, repeat from step 3
  └──────────────────────────────┘
```

### Event Types Handled

| Stellar Event | Database Action | Status Transition |
|---------------|----------------|-------------------|
| `escrow_created` | Create new escrow record | `PENDING` |
| `escrow_funded` | Update existing escrow | `PENDING` → `ACTIVE` |
| `milestone_released` | Log milestone release | (No status change) |
| `escrow_completed` | Mark escrow complete | Any → `COMPLETED` |
| `escrow_cancelled` | Mark escrow cancelled | Any → `CANCELLED` |
| `dispute_raised` | Mark escrow disputed | `ACTIVE` → `DISPUTED` |
| `dispute_resolved` | Log dispute resolution | (Handled separately) |

### Idempotency Guarantee

Events are uniquely identified by the combination of `txHash` and `eventIndex`. Before processing, the service checks:

```typescript
const existingEvent = await this.stellarEventRepository.findOne({
  where: { txHash, eventIndex },
});

if (existingEvent) {
  // Skip - already processed
  return;
}
```

This ensures events are processed exactly once, even if the listener restarts or re-processes ledgers.

### Reconnection Strategy

If the RPC connection fails, the service implements exponential backoff:

- **Max attempts**: 5
- **Initial delay**: 5 seconds
- **Behavior**: Attempts to restart listener, resets counter on success
- **Failure**: Stops listener after max attempts reached

---

## 2. Handling Missed Events (Re-syncing Strategy)

### Automatic Recovery

The listener automatically recovers from interruptions by:

1. **Persisting Progress**: The `lastProcessedLedger` is tracked in memory and recovered from the database on restart
2. **Database Resume Point**: On startup, queries the `stellar_events` table:
   ```typescript
   const lastEvent = await this.stellarEventRepository.findOne({
     where: {},
     order: { ledger: 'DESC' },
   });
   this.lastProcessedLedger = lastEvent?.ledger || startLedger;
   ```
3. **Range Processing**: Processes all ledgers from `lastProcessedLedger + 1` to `latestLedger`, catching up any missed events

### Manual Re-sync

If the backend falls behind or needs to re-process from a specific ledger:

#### Method 1: API Endpoint (Recommended)

```bash
# Sync from a specific ledger
POST /stellar/events/sync?ledger=123456

# Restart the listener (resumes from database)
POST /stellar/events/restart

# Check sync status
GET /stellar/events/status
```

**Response for sync status:**
```json
{
  "isRunning": true,
  "lastProcessedLedger": 123789,
  "reconnectAttempts": 0
}
```

#### Method 2: Programmatic Sync

```typescript
// In any service that injects StellarEventListenerService
await this.stellarEventListenerService.syncFromLedger(123456);
```

This sets `lastProcessedLedger = 123455` and immediately processes all events from ledger 123456 onwards.

#### Method 3: Database Reset (Emergency)

If you need to re-process all events from scratch:

```sql
-- WARNING: This will cause re-processing of all events
DELETE FROM stellar_events;
```

Then restart the backend. The listener will start from `STELLAR_START_LEDGER` environment variable (default: 0).

### Configuration

Environment variables for controlling sync behavior:

| Variable | Description | Default |
|----------|-------------|---------|
| `STELLAR_START_LEDGER` | Ledger to start from if no events exist | 0 |
| `STELLAR_RPC_URL` | Stellar RPC endpoint | `https://soroban-testnet.stellar.org` |
| `STELLAR_CONTRACT_ID` | Vaultix contract address | (required) |

---

## 3. ConsistencyCheckerService - Verification Layer

### Purpose

While `StellarEventListenerService` handles real-time syncing, `ConsistencyCheckerService` provides a verification mechanism to detect discrepancies between the database and the blockchain state.

### Location
```
apps/backend/src/modules/admin/services/consistency-checker.service.ts
```

### How It Works

The service performs direct comparison between:
- **Database state**: Fetched from PostgreSQL via `EscrowService`
- **On-chain state**: Fetched from Soroban contract storage via `SorobanClientService.getEscrow()`

### Comparison Process

```
┌─────────────────────────────────────────────────────────────────┐
│                   CONSISTENCY CHECK FLOW                        │
└─────────────────────────────────────────────────────────────────┘

  Admin Request (escrow IDs or range)
         │
         ▼
  ┌──────────────────────┐
  │ For each escrow ID:  │
  └──────┬───────────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
  ┌──────┐  ┌──────────┐
  │  DB  │  │ On-Chain │ ← SorobanClient.getEscrow(id)
  │ Query│  │  Query   │    (reads contract storage)
  └──┬───┘  └────┬─────┘
     │           │
     └─────┬─────┘
           │
           ▼
  ┌──────────────────────┐
  │ Compare Fields:      │
  │ - Status (mapped)    │
  │ - Amount             │
  └──────┬───────────────┘
         │
         ▼
  ┌──────────────────────┐
  │ Generate Report:     │
  │ - Consistent: true/  │
  │   false              │
  │ - Field mismatches   │
  │ - Missing in DB/Chain│
  └──────────────────────┘
```

### Status Mapping

The service maps contract status enum to database status:

| Contract Status | Database Status |
|----------------|-----------------|
| `Created` | `pending` |
| `Active` | `funded` |
| `Completed` | `completed` |
| `Cancelled` | `cancelled` |
| `Disputed` | `disputed` |
| `ArbiterResolved` | `completed` |

### Usage

**Admin API Endpoint:**
```bash
POST /admin/escrows/consistency-check
Authorization: Bearer <admin_token>

# Check specific escrows
{
  "escrowIds": ["1", "2", "3"]
}

# OR check a range
{
  "fromId": 1,
  "toId": 100
}
```

**Response:**
```json
{
  "reports": [
    {
      "escrowId": 1,
      "isConsistent": true,
      "fieldsMismatched": [],
      "missingInDb": false,
      "missingOnChain": false
    },
    {
      "escrowId": 2,
      "isConsistent": false,
      "fieldsMismatched": [
        {
          "fieldName": "status",
          "dbValue": "active",
          "onchainValue": "Completed"
        }
      ],
      "missingInDb": false,
      "missingOnChain": false
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

### When to Use Consistency Checker

- **After network outages**: Verify no events were missed
- **After manual interventions**: Confirm database matches blockchain
- **Periodic audits**: Scheduled health checks (recommended: daily)
- **Before migrations**: Ensure data integrity before schema changes

---

## 4. Database Schema Mapping for Escrow States

### StellarEvent Entity

**Table**: `stellar_events`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Unique event identifier |
| `txHash` | VARCHAR(64) | Transaction hash (indexed) |
| `eventIndex` | INT | Event index within transaction |
| `eventType` | ENUM | Type of event (see enum below) |
| `escrowId` | VARCHAR | Associated escrow ID |
| `ledger` | INT | Ledger sequence number (indexed) |
| `timestamp` | DATETIME | When the ledger closed (indexed) |
| `rawPayload` | JSON | Complete event data from Stellar |
| `extractedFields` | JSON | Parsed event fields |
| `amount` | DECIMAL(18,7) | Transaction amount |
| `assetCode` | VARCHAR | Asset code (e.g., "XLM") |
| `assetIssuer` | VARCHAR | Asset issuer address |
| `milestoneIndex` | INT | Milestone index (for milestone releases) |
| `fromAddress` | VARCHAR | Source address |
| `toAddress` | VARCHAR | Destination address |
| `reason` | TEXT | Reason for cancellation/dispute |
| `createdAt` | DATETIME | Record creation timestamp |

**Unique Constraint**: `(txHash, eventIndex)` - ensures idempotency

**StellarEventType Enum**:
```typescript
enum StellarEventType {
  ESCROW_CREATED = 'ESCROW_CREATED',
  ESCROW_FUNDED = 'ESCROW_FUNDED',
  MILESTONE_RELEASED = 'MILESTONE_RELEASED',
  ESCROW_COMPLETED = 'ESCROW_COMPLETED',
  ESCROW_CANCELLED = 'ESCROW_CANCELLED',
  DISPUTE_CREATED = 'DISPUTE_CREATED',
  DISPUTE_RESOLVED = 'DISPUTE_RESOLVED',
}
```

### Escrow Entity

**Table**: `escrows`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Escrow identifier |
| `title` | VARCHAR | Escrow title |
| `description` | TEXT | Escrow description |
| `amount` | DECIMAL(18,7) | Escrow amount |
| `assetCode` | VARCHAR | Asset code (default: "XLM") |
| `assetIssuer` | VARCHAR | Asset issuer address |
| `status` | VARCHAR | Current status (see enum below) |
| `type` | VARCHAR | Escrow type (standard/milestone/timed) |
| `creatorId` | VARCHAR (FK) | Creator user ID |
| `releaseTransactionHash` | VARCHAR | Release tx hash |
| `stellarTxHash` | VARCHAR | Stellar transaction hash |
| `fundedAt` | DATETIME | When escrow was funded |
| `isReleased` | BOOLEAN | Release flag |
| `expiresAt` | DATETIME | Expiration timestamp |
| `expirationNotifiedAt` | DATETIME | Last notification time |
| `isActive` | BOOLEAN | Active flag |
| `metadataHash` | VARCHAR | Metadata integrity hash |
| `createdAt` | DATETIME | Creation timestamp |
| `updatedAt` | DATETIME | Last update timestamp |

**Indexes**:
- `idx_escrows_creator` - On `creatorId`
- `idx_escrows_status` - On `status`
- `idx_escrows_asset` - On `(assetCode, assetIssuer)`
- `idx_escrows_created_at` - On `createdAt`
- `idx_escrows_expires_at` - On `expiresAt`
- `idx_escrows_creator_status_created` - Composite index

**EscrowStatus Enum**:
```typescript
enum EscrowStatus {
  PENDING = 'pending',       // Created, awaiting funding
  ACTIVE = 'active',         // Funded and in progress
  COMPLETED = 'completed',   // Successfully completed
  CANCELLED = 'cancelled',   // Cancelled by authorized party
  DISPUTED = 'disputed',     // Under dispute
  EXPIRED = 'expired',       // Past deadline
}
```

### State Transition Diagram

```
                    ┌──────────┐
                    │ PENDING  │ ← escrow_created event
                    └────┬─────┘
                         │
                  escrow_funded
                         │
                         ▼
                    ┌──────────┐
              ┌─────┤  ACTIVE  │
              │     └────┬─────┘
              │          │
              │    ┌─────┴──────┐
              │    │            │
   milestone_released   dispute_raised
              │    │            │
              │    │            ▼
              │    │      ┌──────────┐
              │    │      │ DISPUTED │
              │    │      └────┬─────┘
              │    │           │
              │    │  dispute_resolved
              │    │           │
              │    ▼           ▼
              │     ┌──────────────────┐
              │     │ (returns to flow)│
              │     └──────────────────┘
              │
    escrow_completed OR escrow_cancelled
              │
              ▼
    ┌─────────────────────┐
    │  COMPLETED /        │ ← Terminal states
    │  CANCELLED /        │    (isActive = false)
    │  EXPIRED            │
    └─────────────────────┘
```

### Relationship Between Tables

```
stellar_events (event log)
      │
      │ escrowId (VARCHAR)
      │
      ▼
escrows (current state)
      │
      │ id (UUID)
      │
      ├──→ parties (party.entity.ts)
      ├──→ conditions (condition.entity.ts)
      └──→ events (escrow-event.entity.ts)
```

The `stellar_events` table serves as an **append-only event log**, while the `escrows` table maintains the **current state**. Each event in `stellar_events` may trigger a state update in `escrows`.

---

## 5. Operational Guidelines

### Monitoring Sync Health

1. **Check sync status regularly**:
   ```bash
   GET /stellar/events/status
   ```

2. **Monitor logs for errors**:
   - Look for `Error processing event` messages
   - Watch for `Reconnection attempt` warnings
   - Alert on `Max reconnection attempts reached`

3. **Track ledger gap**:
   Compare `lastProcessedLedger` from sync status with current Stellar ledger to detect lag.

### Troubleshooting

**Problem**: Backend is behind the ledger by many ledgers

**Solution**:
```bash
# Trigger manual sync from last known good ledger
POST /stellar/events/sync?ledger=LAST_KNOWN_LEDGER
```

**Problem**: Events not being processed

**Solution**:
1. Check if listener is running: `GET /stellar/events/status` → `isRunning`
2. Restart listener: `POST /stellar/events/restart`
3. Check logs for parsing errors or RPC connectivity issues

**Problem**: Database inconsistent with blockchain

**Solution**:
1. Run consistency check: `POST /admin/escrows/consistency-check`
2. Identify mismatched escrows from report
3. Trigger re-sync from a ledger before the discrepancy: `POST /stellar/events/sync?ledger=BEFORE_DISCREPANCY`
4. Re-run consistency check to verify

### Best Practices

1. **Never manually modify `stellar_events`** - This table should only be written by the event listener
2. **Use consistency checker weekly** - Schedule automated checks in CI/CD or cron jobs
3. **Monitor RPC rate limits** - The service polls every 10 seconds; adjust if hitting limits
4. **Backup before manual syncs** - Always backup database before triggering re-syncs
5. **Test on testnet first** - Validate sync procedures on Stellar testnet before mainnet operations

---

## 6. Architecture Summary

```
┌──────────────────────────────────────────────────────────────────────┐
│                        VAULTIX SYNC ARCHITECTURE                     │
└──────────────────────────────────────────────────────────────────────┘

  STELLAR BLOCKCHAIN (Soroban)
         │
         │ Events emitted by contract
         │
         ▼
  ┌─────────────────────────────┐
  │  StellarEventListenerService│ ← Real-time processing
  │                             │
  │  - Polls every 10s          │
  │  - Fetches events by range  │
  │  - Parses XDR data          │
  │  - Ensures idempotency      │
  │  - Auto-recovers from fail  │
  └────────┬────────────────────┘
           │
           │ Writes to
           ▼
  ┌─────────────────────────────┐     ┌──────────────────────────┐
  │   PostgreSQL Database       │     │  ConsistencyChecker      │
  │                             │     │  Service                 │
  │  ┌──────────────────────┐   │     │                          │
  │  │ stellar_events       │   │     │  - Compares DB vs Chain  │
  │  │ (append-only log)    │   │◄────│  - Detects mismatches    │
  │  └──────────────────────┘   │     │  - Admin-triggered       │
  │           │                 │     │  - Batch processing      │
  │           │ Updates         │     └──────────────────────────┘
  │           ▼                 │
  │  ┌──────────────────────┐   │
  │  │ escrows              │   │
  │  │ (current state)      │   │
  │  └──────────────────────┘   │
  └─────────────────────────────┘
           │
           │ Serves
           ▼
  ┌─────────────────────────────┐
  │     Frontend / API          │
  │     (User Interface)        │
  └─────────────────────────────┘
```

### Key Design Principles

1. **Event-Driven**: Database state is derived from blockchain events, not direct writes
2. **Idempotent**: Events can be safely re-processed without side effects
3. **Recoverable**: Listener resumes from last processed ledger automatically
4. **Verifiable**: Consistency checker provides ground-truth validation
5. **Observable**: Status endpoints and comprehensive logging for monitoring

---

## Appendix: File Locations

| Component | File Path |
|-----------|-----------|
| Event Listener Service | `apps/backend/src/modules/stellar/services/stellar-event-listener.service.ts` |
| Event Listener Controller | `apps/backend/src/modules/stellar/controllers/stellar-event.controller.ts` |
| Event Entity | `apps/backend/src/modules/stellar/entities/stellar-event.entity.ts` |
| Consistency Checker Service | `apps/backend/src/modules/admin/services/consistency-checker.service.ts` |
| Consistency Checker Controller | `apps/backend/src/modules/admin/controllers/admin-escrow-consistency.controller.ts` |
| Escrow Entity | `apps/backend/src/modules/escrow/entities/escrow.entity.ts` |
| Soroban Client Service | `apps/backend/src/services/stellar/soroban-client.service.ts` |
| Stellar Config | `apps/backend/src/config/stellar.config.ts` |
