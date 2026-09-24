# Walkthrough: Partial Settlement Accounting Fix

## Project context

This repository is a multi-app Web3 escrow platform built around a Soroban smart contract on Stellar. The on-chain code in `apps/onchain/src/lib.rs` manages escrow lifecycle state, milestone releases, dispute flow, fee handling, and expiry/refund rules.

The associated invariant checks live in `apps/onchain/src/invariants.rs`, and the regression suite for escrow rules is in `apps/onchain/src/invariant_tests.rs`.

## Task objective

The goal was to prevent value leakage and lockup risks in partial settlement flows by enforcing a clear reconciliation invariant:

- settled + outstanding + refunded = original deposit

This must remain true across repeated partial operations, fee deductions, expired refunds, and timeout/finalization paths.

## Root issue

The existing invariant logic validated milestone totals and released totals, but it did not assert the broader accounting equality across the full escrow lifecycle. That left a gap where partial settlement or refund logic could drift without being rejected by the persistence boundary.

## Implementation approach

1. Added a partial-settlement accounting invariant in `validate_escrow_invariants`.
2. Kept the rule explicit and deterministic by tying it to the actual escrow fields already persisted in state:
   - `total_released`
   - `funded_amount`
   - `total_amount`
3. Ensured malformed states fail early before writing to storage.
4. Added regression tests for partial-release sequences and invalid accounting states.

## Files updated

- `apps/onchain/src/invariants.rs`
- `apps/onchain/src/invariant_tests.rs`

## Verification note

The Rust contract test command was run locally:

```bash
cd apps/onchain
cargo test --lib --quiet
```

This is currently blocked by the local environment because the Windows C++ linker is missing (`link.exe` not found). The code changes themselves are in place, but the full compile/test pass must be rerun in an environment with MSVC build tools installed.

## Branch naming

This work follows the repo naming convention:

```bash
fix/escrow-partial-accounting-invariant
```
