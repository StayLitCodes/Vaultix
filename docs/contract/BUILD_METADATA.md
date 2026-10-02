# Contract Build Metadata

## Overview

The Vaultix escrow contract embeds identifying metadata directly in the WASM
binary via Soroban's `contractmeta!` macro. This allows operators to verify
which source revision a deployed contract was built from — without relying on
out-of-band records.

The following metadata keys are embedded:

| Key          | Value                                      | Source                  |
| ------------ | ------------------------------------------ | ----------------------- |
| `name`       | `VaultixEscrow`                            | Hardcoded in `lib.rs`   |
| `version`    | Crate version (e.g. `0.1.0`)              | `Cargo.toml` via `env!` |
| `repository` | `https://github.com/StayLitCodes/Vaultix` | Hardcoded in `lib.rs`   |

### Build commit (CI only)

In CI, the `VAULTIX_BUILD_COMMIT` environment variable is set to `${{ github.sha }}`
before `cargo build`. The `build.rs` script forwards this value as a compile-time
environment variable. Local development builds default to `"dev"`.

## Reading metadata from a local WASM file

After building the contract:

```bash
# Build the contract
cargo build --target wasm32v1-none --release

# Inspect metadata from the compiled WASM
stellar contract info meta \
  --wasm target/wasm32v1-none/release/onchain.wasm
```

## Reading metadata from a deployed contract

If you know the WASM hash (printed during `stellar contract upload` or recorded
in `deployments/testnet.json`):

```bash
# Query metadata by WASM hash on testnet
stellar contract info meta \
  --wasm-hash <WASM_HASH> \
  --network testnet
```

Example output:

```text
Contract Meta:
  name: VaultixEscrow
  version: 0.1.0
  repository: https://github.com/StayLitCodes/Vaultix
```

## How it works

### `contractmeta!` macro

The `contractmeta!` macro (from `soroban-sdk`) writes key/value string pairs
into a WASM custom section named `contractmetav0`. These entries survive
optimization (`stellar contract optimize`) and are readable by any Stellar
tooling that parses the custom section.

### `build.rs`

The build script (`apps/onchain/build.rs`) reads the `VAULTIX_BUILD_COMMIT`
environment variable and makes it available at compile time via
`env!("VAULTIX_BUILD_COMMIT")`. It only re-runs when the env var changes, so
it does not slow down incremental builds.

### CI integration

Both CI workflows inject the commit SHA:

- **`contract-ci.yml`** — sets `VAULTIX_BUILD_COMMIT` as a job-level env var.
- **`testnet-deploy.yml`** — sets `VAULTIX_BUILD_COMMIT` on the build step.

This ensures every artifact produced by CI is traceable to a specific git
revision.
