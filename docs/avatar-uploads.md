# Avatar uploads

`POST /auth/profile/avatar` accepts a single `multipart/form-data` field named
`avatar`. The payload is validated **before** any bytes are sent to IPFS, so a
rejected upload never reaches the storage provider.

## Limits

| Rule | Value |
| --- | --- |
| Maximum size | **2 MiB (2,097,152 bytes)** |
| Supported formats | PNG, JPEG, GIF, WebP |
| Field name | `avatar` (one file per request) |

The limit is enforced in two places:

- `AvatarUploadInterceptor` (`apps/backend/src/modules/auth/interceptors/avatar-upload.interceptor.ts`)
  wraps `FileInterceptor` with `limits: { fileSize: 2 MiB, files: 1 }` and maps
  multer failures to stable responses (`413` for `LIMIT_FILE_SIZE`), so memory is
  never spent on a body that cannot be accepted. Multer is resolved through two
  package versions (1.x direct, 2.x via `@nestjs/platform-express`), so the
  error is matched by its `code` rather than by `instanceof`.
- `validateAvatarUpload` (`apps/backend/src/modules/auth/utils/avatar-upload.util.ts`)
  re-checks the buffered payload before the IPFS call.

## Content validation

The client supplied filename and `Content-Type` are **not** trusted. The real
format is detected from the buffer's magic bytes and the payload structure is
verified:

- **PNG** – signature, chunk walk with CRC verification, `IHDR` first chunk and
  terminating `IEND`.
- **JPEG** – SOI marker, a segment walk with a valid `SOF` frame header, and an
  end-of-image marker at the end of the buffer.
- **GIF** – `GIF87a`/`GIF89a` header, non-zero logical screen dimensions and the
  `0x3B` trailer.
- **WebP** – `RIFF`/`WEBP` container with a `VP8 `, `VP8L` or `VP8X` chunk whose
  declared size fits inside the payload.

The filename handed to IPFS is always derived from the detected format
(`avatar.<format>`), never from the client supplied name.

## Error responses

All rejections are stable 4xx responses; the client controlled `filename` and
`Content-Type` are never echoed back in the message.

| Condition | Status | `message` |
| --- | --- | --- |
| No file in the request | 400 | `avatar file is required` |
| Zero-byte file | 400 | `avatar file is empty` |
| Above 2 MiB | 413 | `avatar file exceeds the 2MB limit` |
| Not a supported image (e.g. text file, SVG) | 400 | `avatar must be a PNG, JPEG, GIF or WebP image` |
| Supported magic bytes but broken payload | 400 | `avatar file is not a valid image` |
| Wrong multipart field / malformed request | 400 | `invalid avatar upload request` |
| Missing or invalid access token | 401 | — |

## Response

A successful upload returns the same profile metadata shape as `GET /auth/me`
and `PATCH /auth/profile`:

```json
{
  "id": "…",
  "walletAddress": "G…",
  "isActive": true,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "displayName": null,
  "email": null,
  "emailVerified": false,
  "avatarUrl": "https://gateway.pinata.cloud/ipfs/Qm…",
  "bio": null,
  "preferredAsset": "XLM",
  "kycStatus": "not_started"
}
```

## Tests

- `apps/backend/src/modules/auth/utils/avatar-upload.util.spec.ts` – detection
  and rejection rules.
- `apps/backend/src/modules/auth/services/auth.service.spec.ts` – the service
  never calls `IpfsService.uploadFile` for rejected input.
- `apps/backend/test/e2e/avatar-upload.e2e-spec.ts` – the HTTP endpoint with
  missing, empty, oversized, spoofed, malformed and valid payloads; the IPFS
  provider is mocked and asserted to be untouched for every rejection.
