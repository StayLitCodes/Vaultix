# Cursor pagination

`GET /escrows/cursor` lists the caller's escrows (as creator or party) using keyset pagination. Unlike `GET /escrows` (offset), pages stay stable when rows are inserted and stay fast on large tables.

## Response
```json
{ "items": [ ... ], "nextCursor": "<opaque string or null>" }
```
Pass `nextCursor` back as `cursor` to get the next page. `null` means the last page. Cursors are opaque and invalid ones return `400`.

## Query params
| Param | Description |
| --- | --- |
| `cursor` | From the previous response |
| `limit` | 1-100, default 20 |
| `sortOrder` | `ASC` or `DESC` (default). Sorted by `createdAt`, then `id` as tie-breaker |
| `status` | Escrow status |
| `assetCode`, `assetIssuer` | Asset filter |
| `role` | Only escrows where the caller holds this party role |
| `createdFrom`, `createdTo` | ISO dates, inclusive |

Shared building blocks live in `apps/backend/src/common/pagination` (`CursorPaginationDto`, `buildCursorPage`, `encodeCursor`/`decodeCursor`) for reuse by other list endpoints.

Migration `1790900000000-AddEscrowCursorPaginationIndexes` adds the supporting indexes on `escrows`.
