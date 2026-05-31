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
