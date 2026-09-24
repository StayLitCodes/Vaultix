# Disaster Recovery Runbook — Vaultix Platform

**Document Version:** 1.0  
**Last Updated:** 2026-08-27  
**Classification:** Internal — Operations Team

---

## Table of Contents

1. [Overview](#overview)
2. [Backup Architecture](#backup-architecture)
3. [Backup Schedule](#backup-schedule)
4. [Point-in-Time Recovery](#point-in-time-recovery)
5. [Full Restore Procedure](#full-restore-procedure)
6. [Partial Restore (Selective Recovery)](#partial-restore-selective-recovery)
7. [Backup Verification](#backup-verification)
8. [Storage Quota Management](#storage-quota-management)
9. [Incident Response Playbook](#incident-response-playbook)
10. [Monitoring & Alerts](#monitoring--alerts)
11. [Contact Information](#contact-information)

---

## Overview

Vaultix uses an automated backup strategy to protect against data loss of the SQLite database (`vaultix.db`) which stores all escrow, user, and transaction data.

**Key facts:**
- **Database:** SQLite3 (`apps/backend/data/vaultix.db`)
- **Backup location:** Local (`data/backups/`) + Remote (S3)
- **Encryption:** AES-256-GCM at rest
- **Retention:** Daily (7 days), Weekly (4 weeks), Monthly (12 months)
- **Verification:** Weekly automated restore test (Wednesdays at 5 AM)

---

## Backup Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  SQLite DB   │────▶│ Backup Service│────▶│ Local Disk   │
│  vaultix.db  │     │  (NestJS)    │     │ data/backups │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  AWS S3      │
                    │  (encrypted) │
                    └──────────────┘
```

### Backup Flow

1. **Pre-backup check:** Validates database file integrity and WAL checkpoint
2. **Snapshot:** Uses SQLite's online backup API (`sqlite3.backup()`) for a consistent point-in-time snapshot
3. **Encryption:** AES-256-GCM with a derived key (scrypt) from `BACKUP_ENCRYPTION_KEY`
4. **Checksum:** SHA-256 hash stored for integrity verification
5. **Upload:** Optional S3 upload with server-side encryption (KMS)
6. **Record:** Metadata stored in `backup_record` table
7. **Retention:** Old backups automatically pruned per policy

---

## Backup Schedule

| Type | Schedule | Cron Expression | Retention |
|------|----------|-----------------|-----------|
| Daily | 2:00 AM UTC | `0 2 * * *` | 7 days |
| Weekly | Sunday 3:00 AM UTC | `0 3 * * 0` | 4 weeks |
| Monthly | 1st of month, 4:00 AM UTC | `0 4 1 * *` | 12 months |
| Verification | Wednesday 5:00 AM UTC | `0 5 * * 3` | N/A |

### Triggering Manual Backup

Via API (admin authenticated):

```bash
curl -X POST http://localhost:3000/admin/backup/trigger \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"note": "Pre-deployment backup"}'
```

Optional parameters:
- `retentionPolicy`: Override retention (daily/weekly/monthly)
- `localOnly`: Skip S3 upload (default: false)

---

## Point-in-Time Recovery

Since SQLite does not have built-in WAL shipping, point-in-time recovery relies on the frequency of backups.

### Recovery Time Objectives (RTO/RPO)

| Metric | Target | Notes |
|--------|--------|-------|
| **RPO** (Recovery Point Objective) | ≤ 24 hours | Daily backups at 2 AM |
| **RTO** (Recovery Time Objective) | ≤ 30 minutes | Restore from latest backup |

### Steps for Point-in-Time Recovery

1. **Identify the latest backup before the incident:**
   ```bash
   # List backups with timestamps
   ls -la data/backups/vaultix_backup_*.db.enc | sort
   
   # Or via API
   curl http://localhost:3000/admin/backup/status \
     -H "Authorization: Bearer <TOKEN>"
   ```

2. **Verify the backup integrity:**
   ```bash
   curl -X POST http://localhost:3000/admin/backup/verify/<BACKUP_ID> \
     -H "Authorization: Bearer <TOKEN>"
   ```

3. **Decrypt the backup (if encrypted):**
   ```bash
   # Set the decryption key
   export BACKUP_ENCRYPTION_KEY="your-key-here"
   
   # Decrypt
   openssl enc -aes-256-gcm -d \
     -in data/backups/vaultix_backup_2026-08-27_020000.db.enc \
     -out data/backups/restored.db \
     -pass env:BACKUP_ENCRYPTION_KEY
   ```

4. **Stop the application:**
   ```bash
   # Stop the backend service
   pm2 stop vaultix-backend
   # or
   systemctl stop vaultix-backend
   ```

5. **Replace the database:**
   ```bash
   # Backup current (corrupted) database
   mv data/vaultix.db data/vaultix.db.corrupted.$(date +%s)
   
   # Restore from backup
   cp data/backups/restored.db data/vaultix.db
   
   # Copy WAL/SHM if present
   cp data/backups/restored.db-wal data/vaultix.db-wal 2>/dev/null || true
   cp data/backups/restored.db-shm data/vaultix.db-shm 2>/dev/null || true
   ```

6. **Verify restored database:**
   ```bash
   sqlite3 data/vaultix.db "PRAGMA integrity_check;"
   sqlite3 data/vaultix.db "SELECT COUNT(*) FROM escrow;"
   sqlite3 data/vaultix.db "SELECT COUNT(*) FROM user;"
   ```

7. **Start the application:**
   ```bash
   pm2 start vaultix-backend
   # or
   systemctl start vaultix-backend
   ```

8. **Verify application health:**
   ```bash
   curl http://localhost:3000/health
   curl http://localhost:3000/health/ready
   ```

---

## Full Restore Procedure

### Scenario: Complete data loss (disk failure, accidental deletion)

1. **Assess the situation:**
   - Confirm the database is missing or corrupted
   - Check if S3 backups are available
   - Determine the last known good backup timestamp

2. **Download from S3 (if local backups are unavailable):**
   ```bash
   # Configure AWS CLI
   aws configure
   
   # Download latest backup
   aws s3 cp s3://vaultix-backups/vaultix/backups/ ./restore/ \
     --recursive \
     --include "vaultix_backup_*.db.enc"
   
   # Download the most recent one
   LATEST=$(ls -t restore/vaultix_backup_*.db.enc | head -1)
   ```

3. **Decrypt:**
   ```bash
   openssl enc -aes-256-gcm -d \
     -in "$LATEST" \
     -out ./restore/vaultix.db \
     -pass env:BACKUP_ENCRYPTION_KEY
   ```

4. **Verify integrity:**
   ```bash
   sqlite3 ./restore/vaultix.db "PRAGMA integrity_check;"
   # Should return: ok
   ```

5. **Restore to production:**
   ```bash
   # Stop application
   systemctl stop vaultix-backend
   
   # Ensure data directory exists
   mkdir -p data/
   
   # Copy restored database
   cp ./restore/vaultix.db data/vaultix.db
   
   # Set proper ownership
   chown vaultix:vaultix data/vaultix.db
   
   # Start application
   systemctl start vaultix-backend
   ```

6. **Post-restore verification:**
   ```bash
   # Health check
   curl http://localhost:3000/health
   
   # Verify data integrity
   curl http://localhost:3000/admin/stats \
     -H "Authorization: Bearer <TOKEN>"
   
   # Check escrows are accessible
   curl http://localhost:3000/admin/escrows?limit=5 \
     -H "Authorization: Bearer <TOKEN>"
   ```

---

## Partial Restore (Selective Recovery)

### Scenario: Recover specific escrows or users

1. **Restore backup to a temporary location:**
   ```bash
   sqlite3 ./restore/vaultix.db < backup_decrypted.sql
   ```

2. **Export specific data:**
   ```bash
   # Export specific escrow
   sqlite3 ./restore/vaultix.db \
     "SELECT * FROM escrow WHERE id = 'ESCROW_ID';" \
     -json > recovered_escrow.json
   
   # Export user data
   sqlite3 ./restore/vaultix.db \
     "SELECT * FROM user WHERE walletAddress = 'WALLET_ADDRESS';" \
     -json > recovered_user.json
   ```

3. **Import into production (via application API or direct SQL):**
   ```bash
   # Using the application's admin API for escrow refund
   curl -X POST http://localhost:3000/admin/escrows/REFUND_ID/refund \
     -H "Authorization: Bearer <TOKEN>"
   ```

---

## Backup Verification

### Automated Weekly Verification

The system automatically verifies backups every Wednesday at 5 AM UTC by:
1. Restoring the latest backup to a temporary directory
2. Calculating the SHA-256 checksum
3. Comparing with the original checksum
4. Updating the `restoreTestStatus` field in `backup_record`

### Manual Verification

```bash
# Via API
curl -X POST http://localhost:3000/admin/backup/verify/<BACKUP_ID> \
  -H "Authorization: Bearer <TOKEN>"
```

Expected response:
```json
{
  "verified": true,
  "originalChecksum": "abc123...",
  "restoreChecksum": "abc123...",
  "verifiedAt": "2026-08-27T10:00:00.000Z"
}
```

### Manual Checksum Verification

```bash
# Calculate checksum of backup
sha256sum data/backups/vaultix_backup_2026-08-27_020000.db

# Compare with stored checksum in database
sqlite3 data/vaultix.db \
  "SELECT checksum FROM backup_record WHERE id = 'BACKUP_ID';"
```

---

## Storage Quota Management

### Current Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `BACKUP_STORAGE_QUOTA_BYTES` | 10,737,418,240 (10 GB) | Maximum total backup storage |
| `BACKUP_ALERT_THRESHOLD_PERCENT` | 80 | Alert when usage exceeds this % |

### Check Storage Usage

```bash
# Via API
curl http://localhost:3000/admin/backup/status \
  -H "Authorization: Bearer <TOKEN>"
```

Response includes:
```json
{
  "storageQuota": {
    "usedBytes": 5368709120,
    "quotaBytes": 10737418240,
    "usagePercent": 50.0,
    "alertThreshold": 80,
    "isOverThreshold": false
  }
}
```

### Manual Retention Cleanup

```bash
# Apply retention policy manually
curl -X POST http://localhost:3000/admin/backup/retention/apply \
  -H "Authorization: Bearer <TOKEN>"
```

### Adjusting Retention

Modify the retention periods in `backup.service.ts`:
- **Daily backups:** Keep for 7 days (line ~380)
- **Weekly backups:** Keep for 28 days (line ~390)
- **Monthly backups:** Keep for 12 months (line ~400)

---

## Incident Response Playbook

### Scenario 1: Database Corruption

**Severity:** Critical  
**Response Time:** Immediate  

1. **Detect:** Application health check fails or data inconsistency detected
2. **Contain:**
   ```bash
   # Stop the application immediately
   systemctl stop vaultix-backend
   ```
3. **Assess:**
   ```bash
   # Check database integrity
   sqlite3 data/vaultix.db "PRAGMA integrity_check;"
   ```
4. **Recover:** Follow [Full Restore Procedure](#full-restore-procedure)
5. **Verify:** Run health checks and spot-check critical data
6. **Communicate:** Notify stakeholders of data loss window (RPO)

### Scenario 2: Accidental Data Deletion

**Severity:** High  
**Response Time:** < 1 hour  

1. **Stop writes:** Pause the application or put it in read-only mode
2. **Identify deletion timestamp:** Check application logs
3. **Find appropriate backup:** Use backup before deletion time
4. **Recover:** Follow [Partial Restore](#partial-restore-selective-recovery)
5. **Verify:** Confirm recovered data matches expected state

### Scenario 3: Disk Failure

**Severity:** Critical  
**Response Time:** Immediate  

1. **Assess:** Check if local backups survived
2. **Download from S3:** Follow [Full Restore Procedure](#full-restore-procedure) step 2
3. **Provision new storage:** Attach new EBS volume or equivalent
4. **Restore:** Complete the restore procedure
5. **Update monitoring:** Ensure backup paths are correct

### Scenario 4: Backup Verification Failure

**Severity:** Medium  
**Response Time:** < 4 hours  

1. **Check which backup failed verification**
2. **Attempt manual verification:**
   ```bash
   curl -X POST http://localhost:3000/admin/backup/verify/<BACKUP_ID> \
     -H "Authorization: Bearer <TOKEN>"
   ```
3. **If checksum mismatch:** Backup may be corrupted — trigger a new backup
4. **Investigate root cause:** Check disk health, encryption key validity

---

## Monitoring & Alerts

### Automated Alerts

| Alert | Condition | Action |
|-------|-----------|--------|
| Backup Failed | `BACKUP_FAILED` audit log | Investigate immediately |
| Storage > 80% | Usage exceeds threshold | Clean up old backups |
| Verification Failed | `restoreTestStatus = 'failed'` | Re-trigger backup |
| No Backups (24h) | No completed backup in 24h | Check cron job health |

### Log Queries

```bash
# Check backup audit logs
sqlite3 data/vaultix.db \
  "SELECT * FROM admin_audit_log WHERE actionType LIKE 'BACKUP_%' ORDER BY createdAt DESC LIMIT 20;"
```

### Health Endpoint

```bash
# Overall system health (includes backup status)
curl http://localhost:3000/health | jq '.dependencies'
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BACKUP_LOCAL_DIR` | No | `./data/backups` | Local backup storage path |
| `BACKUP_ENCRYPTION_KEY` | Yes* | — | AES-256-GCM encryption key (min 32 chars) |
| `BACKUP_S3_BUCKET` | No | — | S3 bucket name |
| `BACKUP_S3_PREFIX` | No | `vaultix/backups` | S3 key prefix |
| `BACKUP_S3_REGION` | No | `us-east-1` | AWS region |
| `BACKUP_S3_ACCESS_KEY` | No** | — | AWS access key |
| `BACKUP_S3_SECRET_KEY` | No** | — | AWS secret key |
| `BACKUP_S3_ENDPOINT` | No | — | Custom S3 endpoint (e.g., MinIO) |
| `BACKUP_STORAGE_QUOTA_BYTES` | No | `10737418240` | Max storage (10 GB) |
| `BACKUP_ALERT_THRESHOLD_PERCENT` | No | `80` | Alert threshold % |

\* Required for encrypted backups  
\** Required for S3 uploads

---

## Frequently Asked Questions

### Q: How do I trigger an emergency backup?
```bash
curl -X POST http://localhost:3000/admin/backup/trigger \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"note": "Emergency backup before incident response", "retentionPolicy": "weekly"}'
```

### Q: How do I verify a specific backup?
```bash
curl -X POST http://localhost:3000/admin/backup/verify/<BACKUP_UUID> \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### Q: What if the encryption key is lost?
Backups encrypted with a lost key are **unrecoverable**. Ensure the key is stored securely:
- Use a secrets manager (AWS Secrets Manager, HashiCorp Vault)
- Maintain a secure backup of the key separate from the database backups
- Document key rotation procedures

### Q: How do I check backup status?
```bash
curl http://localhost:3000/admin/backup/status \
  -H "Authorization: Bearer <ADMIN_TOKEN>" | jq .
```

### Q: Can I use MinIO instead of S3?
Yes. Set `BACKUP_S3_ENDPOINT` to your MinIO endpoint URL.

---

## Appendix: Database Schema Reference

The backup system uses the following entity:

```sql
CREATE TABLE backup_record (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  localPath TEXT,
  remotePath TEXT,
  sizeBytes INTEGER NOT NULL,
  status TEXT NOT NULL,           -- in_progress, completed, failed
  backupType TEXT NOT NULL,       -- scheduled, manual, verification
  retentionPolicy TEXT NOT NULL,  -- daily, weekly, monthly
  encrypted INTEGER NOT NULL DEFAULT 0,
  checksum TEXT,
  metadata TEXT,                  -- JSON
  restoreTestStatus TEXT,         -- passed, failed
  errorMessage TEXT,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL
);
```
