# Add Secure Admin-Controlled Contract Upgrade (Safe Upgrade Pattern)

## Summary

This PR implements a secure, admin-controlled contract upgrade pattern ("Safe Upgrade" / Admin Proxy) for the VaultixEscrow Soroban contract. It allows protocol maintainers to fix bugs or add features without migrating all state and users to a new contract address.

## Key Changes

- **Upgrade Functionality:**  
  - Added `upgrade(env, new_wasm_hash: [u8; 32])` to the contract, callable only by the admin.
  - Emits a `ContractUpgraded` event before performing the upgrade.
  - Enforces strict access control (admin-only).
  - Documents storage compatibility requirements for future upgrades.

- **Testing:**  
  - Integration test verifies:
    - State is preserved across upgrades.
    - Unauthorized users cannot trigger upgrades.
    - New contract logic is accessible after upgrade.

## Motivation

Soroban allows contract upgrades via `env.deployer().update_current_contract_wasm`. This PR wraps that capability in a secure, admin-controlled function to ensure only authorized upgrades, protecting user funds and protocol integrity.

## Acceptance Criteria

- [x] `upgrade` function exists and is admin-protected.
- [x] Emits upgrade event.
- [x] Storage compatibility is documented.
- [x] Integration test proves code can be swapped while keeping escrow storage intact.
- [x] Unauthorized users cannot trigger an upgrade.

## Non-Goals

- DAO-voting based upgrades (admin-only for now).

---

**Reviewer Notes:**  
- Please review the storage compatibility comment for future upgrade safety.
- All tests pass (`cargo test`).
- No breaking changes to existing escrow logic.

---
