# Mobile Escrow QR Payload

The mobile app uses the existing Vaultix escrow share URL as the canonical QR payload.

## Canonical format

```text
https://vaultix.app/escrow/{escrowId}
```

`EXPO_PUBLIC_WEB_BASE_URL` may replace `https://vaultix.app` for a configured Vaultix web host.

`{escrowId}` is the opaque backend escrow ID. The mobile validator accepts IDs containing ASCII letters, digits, `_`, and `-`, with a length of 6–128 characters. This covers UUID-style IDs such as:

```text
550e8400-e29b-41d4-a716-446655440000
```

The QR code contains the complete share URL, not the legacy `ESCROW_...` synthetic format.

## Scanner behavior

`validateQRCode` verifies that the payload:

1. is an HTTPS URL,
2. uses the configured Vaultix web host (or the default `vaultix.app` host),
3. has the `/escrow/{escrowId}` path,
4. contains a valid backend escrow ID.

The scanner returns the extracted `escrowId` to `onEscrowScanned`, so consumers do not need to parse the URL themselves.

## QR generation

The escrow detail screen exposes a **QR** action. It renders the same URL returned by `buildEscrowShareUrl`, ensuring the app's QR generator and scanner use one canonical payload format.

The generated QR therefore follows the same path as the existing Share Escrow action:

```text
Escrow ID -> buildEscrowShareUrl -> QR code -> QRScannerModal -> onEscrowScanned(escrowId)
```
