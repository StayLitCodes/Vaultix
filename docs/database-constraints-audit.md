# Database Constraints Audit

## Purpose

Ensure all TypeORM entities have appropriate database-level constraints
to prevent invalid data from entering the system.

## Findings & Recommendations

### `users` table

| Column | Current | Recommended |
|---|---|---|
| `walletAddress` | `UNIQUE` | ✅ OK |
| `email` | `UNIQUE, nullable` | ✅ OK |
| `displayName` | `varchar(100), nullable` | ✅ OK |
| `role` | `text enum` | Add `CHECK` via migration |

### `refresh_tokens` table

| Column | Current | Recommended |
|---|---|---|
| `token` | no index | Add `UNIQUE` constraint |
| `expiresAt` | no constraint | Add `CHECK (expires_at > created_at)` |

### `escrow` entities

- Add `CHECK` constraint: `amount > 0`
- Add `NOT NULL` on `status` column where currently missing

## Migration Plan

Generate a migration after applying the entity changes:

```bash
npm run migration:generate -- --name AddMissingConstraints -d src/data-source.ts
npm run migration:run
```