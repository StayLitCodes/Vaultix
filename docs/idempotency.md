# Idempotency keys

Mutating escrow endpoints accept an optional `Idempotency-Key` header so clients can safely retry (flaky networks, double-clicks):

- `POST /escrows`
- `POST /escrows/:id/fund`
- `POST /escrows/:id/release`
- `POST /escrows/:id/dispute`

| Situation | Result |
| --- | --- |
| No header | Request runs normally |
| New key | Request runs; status and body are stored |
| Same key + same payload | Stored response is replayed with `Idempotent-Replayed: true`; nothing runs again |
| Same key + different payload | `422 Unprocessable Entity` |
| Same key while the first request is still running | `409 Conflict` |
| Handler error | Not stored; retry with the same key is allowed |
| Key empty or over 255 chars | `400 Bad Request` |

Keys are scoped per user and per endpoint, and the payload hash covers body, route params and query. Keys expire after `IDEMPOTENCY_TTL_SECONDS` (default `86400`); expired rows are purged hourly.

Migration `1791000000000-AddIdempotencyKeys` (SQLite and Postgres) creates the `idempotency_keys` table. Code lives in `apps/backend/src/common/idempotency`; add `@UseInterceptors(IdempotencyInterceptor)` to opt other endpoints in.
