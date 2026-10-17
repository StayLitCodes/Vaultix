# Universal Links / App Links (#717)

Shared escrow and invite URLs use `https://vaultix.app/...`. For those taps to open the mobile app instead of the browser, host the files below on the `vaultix.app` origin and ship the `app.json` associated-domains / intentFilters config.

## iOS — `apple-app-site-association`

Host at:

- `https://vaultix.app/.well-known/apple-app-site-association`
- `https://vaultix.app/apple-app-site-association`

Content-Type: `application/json` (no `.json` extension required).

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAMID.io.vaultix.mobile",
        "paths": ["/escrow/*", "/invite/*"]
      }
    ]
  }
}
```

Replace `TEAMID` with the Apple Developer Team ID.

## Android — `assetlinks.json`

Host at:

- `https://vaultix.app/.well-known/assetlinks.json`

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "io.vaultix.mobile",
      "sha256_cert_fingerprints": ["AA:BB:CC:…:FF"]
    }
  }
]
```

Use the SHA-256 fingerprint of the Play App Signing certificate (or debug keystore for local testing).

## Expo Router prefixes

Custom scheme `vaultix://` and HTTPS hosts resolve to the same routes:

| URL | Route |
|-----|--------|
| `vaultix://escrow/{id}` | `/escrow/[id]` (or app-equivalent) |
| `https://vaultix.app/escrow/{id}` | same |
| `vaultix://invite/{token}` | `/invite/[token]` |
| `https://vaultix.app/invite/{token}` | same |

## Web fallback (app not installed)

Serve a lightweight landing page on `https://vaultix.app/escrow/*` and `/invite/*` that:

1. Attempts to open `vaultix://…` via an intent/universal redirect.
2. After ~1s, shows App Store / Play Store badges and a short explanation.
3. Does not break open-graph previews for shared links.

## QA checklist

- [ ] Cold start from `https://vaultix.app/invite/{token}` opens invite screen
- [ ] Cold start from `https://vaultix.app/escrow/{id}` opens escrow detail
- [ ] `vaultix://invite/{token}` still works in dev
- [ ] Browser fallback appears when app is not installed
