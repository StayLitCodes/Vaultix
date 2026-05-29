# Mobile wallet connection strategy

## Selected approach

Vaultix mobile uses native wallet deep links as the primary connection strategy. This keeps wallet approval inside the installed mobile wallet app, which is the most reliable method for mobile Stellar users who need to sign messages or transaction prompts.

### Why this approach

- Native wallet apps can prompt users to sign securely on-device.
- Deep links are lightweight and fit the existing Expo mobile stack.
- The app can verify returned signatures locally using Stellar's public-key verification.

## UX behavior

- Users choose a supported wallet from the connect screen.
- Vaultix opens the wallet app using a mobile deep-link.
- The wallet returns to Vaultix through the configured `vaultix://` callback scheme.
- Vaultix verifies the signed challenge, shows the connected wallet address, and allows retry or wallet switching.

## Supported wallets and limitations

### Supported

- `LOBSTR` (recommended native mobile wallet)

### Platform notes

- iOS: supported when the wallet app is installed and can handle the deep link.
- Android: supported when the wallet app is installed and can handle the deep link.

### Limitations

- Wallet callback handling depends on the installed wallet app returning to the app through the registered callback scheme.
- Deep-link support is only guaranteed for wallets that support native link handling.
- Browser-style wallet flows are not embedded inside the mobile app.
- If no wallet is installed, the user must install the wallet first and retry the connection.

## Recoverable error handling

- Retry re-opens the wallet connection flow.
- Switching wallets resets the pending signed challenge and starts a clean connection attempt.
- Invalid signatures are surfaced as a recoverable error and do not leave the app in a broken connected state.
