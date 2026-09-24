# Concurrent Session Management

## Overview

This document describes the design for limiting concurrent sessions per user
and revoking tokens when the session limit is exceeded.

## Design

### Session limit

Each user may have at most **5** active sessions simultaneously. When a new
login exceeds this limit the oldest refresh token is revoked automatically.

### Token revocation flow

1. User logs in → `AuthService.verifySignature` creates a refresh token via `UserService.createRefreshToken`.
2. Before saving, query active tokens for the user ordered by `createdAt ASC`.
3. If `count >= MAX_SESSIONS`, call `UserService.invalidateRefreshToken` on the oldest token.
4. Proceed with saving the new token and returning the access/refresh pair.

### Key constants

```ts
const MAX_SESSIONS = 5;
```

### API endpoint

`POST /v1/auth/logout-all` — invalidates **all** active refresh tokens for the
authenticated user. Requires a valid `Authorization: Bearer <accessToken>` header.

## Future work

- Emit a `session.revoked` event so connected WebSocket clients can notify the user.
- Add a `deviceInfo` field to `RefreshToken` to display session metadata in the UI.