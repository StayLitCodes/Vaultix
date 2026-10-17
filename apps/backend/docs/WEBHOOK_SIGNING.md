# Outgoing Webhook Signing

Every webhook endpoint has its own signing secret. `POST /v1/webhooks` can accept a caller-provided `secret`; if omitted, Vaultix generates a cryptographically random 32-byte secret. The create response returns the secret once. `GET /v1/webhooks` never returns signing secrets.

## Verify Each Delivery

Vaultix sends the JSON request body with these headers:

| Header | Value |
| --- | --- |
| `X-Vaultix-Timestamp` | Unix timestamp in seconds |
| `X-Vaultix-Signature` | One or more comma-separated `sha256=<hex>` HMACs |

The HMAC-SHA256 input is the timestamp, a period, and the exact raw request-body bytes: `timestamp + "." + rawBody`. Verify against the raw bytes before parsing JSON. Reject timestamps more than five minutes from the receiver's current time, then atomically claim the timestamp/signature pair in a shared replay cache with a five-minute TTL. Reject the request if that pair was already claimed. Use a distributed cache for multi-instance receivers. Compare signatures with a constant-time comparison.

### Node.js

Capture the raw request body in your HTTP framework before JSON parsing. For example, with Express, retain the `Buffer` in a raw-body middleware and pass it to this verifier:

```js
import { createHmac, timingSafeEqual } from 'node:crypto';

export async function verifyVaultixWebhook({ headers, rawBody, secrets, replayStore }) {
  const timestamp = headers['x-vaultix-timestamp'];
  const signatureHeader = headers['x-vaultix-signature'];
  if (typeof timestamp !== 'string' || !/^\d+$/.test(timestamp)) return false;
  if (typeof signatureHeader !== 'string') return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const received = signatureHeader
    .split(',')
    .map((value) => value.trim().match(/^sha256=([a-f0-9]{64})$/i)?.[1])
    .filter(Boolean);
  const signedContent = Buffer.concat([
    Buffer.from(`${timestamp}.`, 'utf8'),
    Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody),
  ]);

  const valid = secrets.some((secret) => {
    const expected = createHmac('sha256', secret).update(signedContent).digest();
    return received.some((value) => {
      const supplied = Buffer.from(value, 'hex');
      return supplied.length === expected.length && timingSafeEqual(supplied, expected);
    });
  });
  if (!valid) return false;
  return replayStore.claim(`${timestamp}:${signatureHeader}`, 300);
}
```

`replayStore.claim(key, ttlSeconds)` must atomically store a previously unseen key and return `true` only to the first caller. For example, implement it with Redis `SET key value NX EX ttl`.
Because the replay-store claim can be asynchronous, await `verifyVaultixWebhook(...)` before accepting the request.

### Python

With Flask, call `request.get_data(cache=True)` before parsing or transforming the JSON body:

```python
import hashlib
import hmac
import re
import time

def verify_vaultix_webhook(request, secrets, replay_cache):
    timestamp = request.headers.get("X-Vaultix-Timestamp", "")
    signature_header = request.headers.get("X-Vaultix-Signature", "")
    if not re.fullmatch(r"\d+", timestamp):
        return False
    if abs(time.time() - int(timestamp)) > 300:
        return False

    signatures = {
        match.group(1)
        for value in signature_header.split(",")
        if (match := re.fullmatch(r"\s*sha256=([a-f0-9]{64})\s*", value, re.I))
    }
    signed_content = timestamp.encode("utf-8") + b"." + request.get_data(cache=True)
    valid = any(
        hmac.compare_digest(
            hmac.new(secret.encode("utf-8"), signed_content, hashlib.sha256).hexdigest(),
            signature,
        )
        for secret in secrets
        for signature in signatures
    )
      if not valid:
        return False
      replay_key = f"vaultix:{timestamp}:{signature_header}"
      return replay_cache.set(replay_key, "1", nx=True, ex=300)
```

    Here `replay_cache.set` is an atomic Redis-style `SET ... NX EX` operation. Use a shared cache when the receiver runs more than one instance.

## Rotate a Secret

Call `POST /v1/webhooks/:id/rotate-secret` while authenticated as the endpoint owner. The response contains the new secret and `previousSecretExpiresAt`; store the new value securely because it is not returned by the list endpoint. For 24 hours, deliveries include signatures from both the new and previous secret. Receivers should verify against both during this overlap, then remove the previous secret after the expiry. Each delivery attempt receives a fresh timestamp and signature. A subsequent rotation replaces the prior grace secret.