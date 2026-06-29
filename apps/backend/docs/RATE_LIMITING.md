# Rate Limiting Policy

All Vaultix API endpoints are protected by tiered rate limiting implemented via
`@nestjs/throttler` v6 and a custom `VaultixThrottlerGuard`.

## Tiers

| Endpoint group | Method | Limit | Window | Tracking |
|---|---|---|---|---|
| GET endpoints (global default) | GET | **100 req/min** | 60 s | IP address |
| Auth — challenge / verify | POST | **5 req/min** | 60 s | IP address |
| Auth — refresh | POST | **20 req/min** | 60 s | IP address |
| Auth — logout | POST | **10 req/min** | 60 s | IP address |
| Create escrow | POST /escrows | **20 req/min** | 60 s | Authenticated user ID |
| Create webhook | POST /webhooks | **10 req/min** | 60 s | Authenticated user ID |

## Response headers

Every response includes rate-limit metadata headers:

| Header | Value |
|---|---|
| `X-RateLimit-Limit` | Maximum requests allowed in the window |
| `X-RateLimit-Remaining` | Requests remaining before the limit is reached |
| `X-RateLimit-Reset` | Seconds until the current window resets |

For the per-user throttler the headers carry a `-user` suffix
(`X-RateLimit-Limit-user`, etc.).

## 429 Too Many Requests

When a limit is exceeded the server responds with HTTP **429** and the following
additional headers:

| Header | Value |
|---|---|
| `Retry-After` | Seconds to wait before retrying |

The response body follows the standard NestJS error format:

```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}
```

## IP extraction

The guard reads the client IP from `X-Forwarded-For` (first value) and falls
back to `req.ip` / `req.connection.remoteAddress`. Ensure your reverse-proxy
sets `X-Forwarded-For` to the real client IP.

## Tracking strategy

| Throttler | Tracker used |
|---|---|
| `default` (IP-based) | Client IP address |
| `user` (user-based) | JWT `sub` (user ID). Falls back to IP when the request has no valid token |

## Logging

Rate-limit violations are logged at **warn** level using the `RateLimit` logger:

```
[RateLimit] Rate limit exceeded | POST /escrows | limit=20 | ip=1.2.3.4
```

## Configuration

Limits are set in `src/app.module.ts` (`ThrottlerModule.forRoot`) and overridden
per-endpoint via `@Throttle` decorators.

In `NODE_ENV=test` the global limits are raised to 10 000 req/min so normal
test flows do not trigger throttling.
