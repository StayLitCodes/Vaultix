# Admin Quick Reference: Consistency Checker

## What is it?
Automated system that verifies your database matches the blockchain state. Catches issues from failed transactions, missed webhooks, or manual database edits.

## When to Use

### Automatic Checks (No Action Needed)
- **Daily at 2 AM**: All active escrows checked automatically
- **Every Hour**: Stale escrows (no update in 24h) checked automatically

### Manual Checks (When You Need Them)
- After system maintenance
- After blockchain network issues
- When investigating user reports
- Before critical operations

## Quick Commands

### 1. Check Specific Escrows
```bash
curl -X POST http://localhost:3000/admin/consistency/check \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"escrowIds": ["escrow-id-1", "escrow-id-2"]}'
```

### 2. View Critical Issues
```bash
curl -X GET "http://localhost:3000/admin/consistency/reports?severity=critical&resolved=false" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 3. Check Single Escrow Details
```bash
curl -X GET "http://localhost:3000/admin/consistency/escrow-id-123" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 4. Fix a Discrepancy
```bash
curl -X POST http://localhost:3000/admin/consistency/resolve \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "escrowId": "escrow-id-123",
    "adminUserId": "your-admin-id",
    "syncToOnchain": true
  }'
```

## Understanding Severity

| Severity | What It Means | Action Required |
|----------|---------------|-----------------|
| **CRITICAL** | Status or amount mismatch | Immediate action |
| **WARNING** | Party mismatch, missing events | Review soon |
| **INFO** | Minor inconsistencies | Monitor |

## Common Scenarios

### Scenario 1: Status Mismatch
**Problem**: DB shows "active", blockchain shows "completed"
**Cause**: Webhook missed or transaction succeeded but DB update failed
**Fix**: Use resolve endpoint with `syncToOnchain: true`

### Scenario 2: Amount Mismatch
**Problem**: DB shows 100 XLM, blockchain shows 200 XLM
**Cause**: Manual DB edit or partial transaction
**Fix**: Investigate transaction history, then resolve

### Scenario 3: Missing On-Chain
**Problem**: Escrow exists in DB but not on blockchain
**Cause**: Transaction never submitted or failed
**Fix**: Cancel escrow in DB or retry blockchain submission

## Response Examples

### Healthy Escrow
```json
{
  "escrowId": 1,
  "isConsistent": true,
  "fieldsMismatched": []
}
```

### Critical Issue
```json
{
  "escrowId": 2,
  "isConsistent": false,
  "fieldsMismatched": [
    {
      "fieldName": "status",
      "dbValue": "active",
      "onchainValue": "Completed"
    }
  ]
}
```

## Best Practices

1. **Check reports daily** - Review critical issues first thing
2. **Investigate before resolving** - Understand why discrepancy occurred
3. **Document resolutions** - Add notes in audit log
4. **Monitor patterns** - Recurring issues may indicate system problems
5. **Sync carefully** - `syncToOnchain: true` overwrites DB with blockchain state

## Troubleshooting

### "Escrow not found on-chain"
- Transaction may have failed
- Check Stellar transaction hash in DB
- Verify contract deployment

### "Cannot resolve discrepancy"
- Ensure you have admin permissions
- Check escrow is not in terminal state
- Verify blockchain connection

### "Too many discrepancies"
- May indicate systemic issue
- Check webhook service health
- Review recent deployments

## Getting Help

- Check logs: `apps/backend/logs/consistency-checker.log`
- Review audit trail: `GET /admin/audit-logs?resourceType=escrow`
- Contact dev team with escrow ID and timestamp

## Monitoring Dashboard (Coming Soon)
- Real-time consistency metrics
- Trend analysis
- Auto-resolution suggestions
