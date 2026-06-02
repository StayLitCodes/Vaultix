# Mobile Security & Secrets Hygiene

This document covers the environment setup, secret handling, and testnet/mainnet switching strategies for the Vaultix mobile application.

## Environment Setup
We use `.env` files and `expo-secure-store` to manage configuration and sensitive data safely. Ensure that the `.env` files are never checked into version control.

### Testnet / Mainnet Switching
Our environment configuration is typed and managed inside `apps/mobile/security/env.ts`.
By setting `EXPO_PUBLIC_APP_ENV` to `dev`, `testnet`, or `production`, the app switches its `apiUrl` and `rpcUrl` seamlessly.

## Secret Handling
**Never store the following data in plain text, AsyncStorage, or Redux state:**
- Private keys
- Seed phrases
- Secret wallet data

Instead, we use `utils/secureStore.ts` wrapper around `expo-secure-store` which uses platform-specific secure enclaves (Keychain on iOS, Keystore on Android).

## Mobile Wallet Connection
Vaultix mobile supports a built-in secure Stellar wallet that lives on the device and signs messages/transactions locally. The app stores the wallet seed securely, and the wallet address is persisted in the secure enclave rather than in plain app state.

Supported mobile wallet options:
- Built-in secure mobile wallet: recommended for Android and iOS
- External wallet guidance: open Lobstr or Solar mobile wallet installation pages from the app

Limitations:
- External wallet deep-link integration is limited by wallet vendor support. Vaultix mobile currently provides guidance and app-open links, not a fully generic SEP-7 redirect flow.
- Browser-extension wallets like Freighter are not supported on mobile devices.
- If the device secure store is cleared, the mobile wallet seed is lost unless the user exports it manually.
- The mobile wallet implementation is focused on signing and transaction approval on-device, with recoverable retry and switch-wallet flows built into the connection experience.
