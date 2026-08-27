# VaultixEscrow Contract Deployment Runbook

Production-grade deployment, initialization, upgrade, and incident-response procedures for the VaultixEscrow Soroban smart contract.

---

## 1. Build & Artifact Output

### Prerequisites

- Rust toolchain with the `wasm32-unknown-unknown` target installed
- `stellar-cli` installed (Soroban-compatible version matching SDK 27.x)
- Package name in `apps/onchain/Cargo.toml` is exactly `onchain` — the compiled
  WASM artifact name is **always derived from this package name**.

### 1.1 Install target

```bash
rustup target add wasm32-unknown-unknown
```

### 1.2 Build optimized release WASM

From the **repository root** (workspace root) run:

```bash
cargo build --target wasm32-unknown-unknown --release --package onchain
```

Or from the `apps/onchain` directory:

```bash
cargo build --target wasm32-unknown-unknown --release
```

### 1.3 Artifact path & filename

After a successful build the un-optimized artifact is located at:

```
apps/onchain/target/wasm32-unknown-unknown/release/onchain.wasm
```

If the workspace is configured to emit artifacts into a shared target directory
at the repository root the path is instead:

```
target/wasm32-unknown-unknown/release/onchain.wasm
```

### 1.4 Contract optimization (required for production)

Soroban enforces a WASM size limit. Run the Stellar CLI optimizer:

```bash
stellar contract optimize \
  --wasm target/wasm32-unknown-unknown/release/onchain.wasm
```

The optimized artifact is written to:

```
target/wasm32-unknown-unknown/release/onchain.optimized.wasm
```

> ⚠️ **Always deploy the `onchain.optimized.wasm` artifact in production.**
> Deploying the un-optimized `onchain.wasm` may exceed the network size cap or
> waste excessive storage fees. No other artifact names are valid — the output
> filename is strictly derived from the `onchain` package name in Cargo.toml.

---

## 2. Deployment Steps

### 2.1 Select network & configure Stellar CLI

| Parameter | Testnet | Mainnet (Pubnet) |
|-----------|---------|------------------|
| Network name | `testnet` | `public` |
| RPC endpoint | `https://soroban-testnet.stellar.org:443` | `https://soroban.stellar.org:443` |
| Network passphrase | `Test SDF Network ; September 2015` | `Public Global Stellar Network ; September 2015` |
| Friendbot (funding) | `https://friendbot.stellar.org` | N/A — fund from a real XLM source |

Configure an alias in `stellar-cli`:

```bash
# Testnet
stellar network add testnet https://soroban-testnet.stellar.org:443 \
  --network-passphrase "Test SDF Network ; September 2015"

# Mainnet
stellar network add public https://soroban.stellar.org:443 \
  --network-passphrase "Public Global Stellar Network ; September 2015"
```

### 2.2 Fund the deployer account

**Testnet:**

```bash
stellar keys generate deployer --network testnet
stellar keys fund deployer --network testnet
```

**Mainnet:**

The deployer account must hold enough XLM to cover:
- Contract WASM installation (depends on optimized WASM byte size)
- Contract instantiation (fixed fee)
- Instance storage entries written during initialization

Fund the deployer address from an existing mainnet wallet or exchange.

```bash
stellar keys add deployer --network public
# Verify balance before deploying:
stellar keys balance deployer --network public
```

### 2.3 Install (upload) the optimized WASM

```bash
stellar contract install \
  --network <NETWORK> \
  --source deployer \
  --wasm target/wasm32-unknown-unknown/release/onchain.optimized.wasm
```

This command returns a **WASM hash** (32-byte hex). Save it — it is required
for `upgrade` invocations later.

### 2.4 Deploy (instantiate) the contract

```bash
stellar contract deploy \
  --network <NETWORK> \
  --source deployer \
  --wasm-hash <WASM_HASH_FROM_STEP_2_3>
```

This returns the deployed **contract ID** (32-byte hex). Record it in the
deployment registry; every subsequent invocation requires it.

> **Testnet vs Mainnet confirmation differences:**
> - *Testnet:* Soroban state write is usually confirmed within 5-10 seconds.
> - *Mainnet:* Expect 5-8 ledger close cycles (~25-40 s) before the new
>   instance is visible to all RPC nodes. Do not run initialization commands
>   until the deployment transaction is finalized; retry on `HostStorageError`
>   or `MissingValue` with exponential backoff.

---

## 3. Initialization Flow (CRITICAL)

The contract exposes **two separate init-style entrypoints**. They MUST be
invoked in the exact order documented below. Swapping, skipping, or re-running
either call produces an unusable contract.

### Required order

```
Step 1 — initialize(treasury, fee_bps)
  ↓
Step 2 — init(admin, operator, arbitrator)
```

### 3.1 Step 1: `initialize(treasury, fee_bps)`

```bash
stellar contract invoke \
  --network <NETWORK> \
  --source deployer \
  --id <CONTRACT_ID> \
  -- initialize \
    --treasury <TREASURY_ADDRESS> \
    --fee-bps 50
```

Arguments:
- `treasury` (Address): the platform address that receives collected platform
  fees. The treasury account **must authenticate** this call.
- `fee_bps` (Optional<i128>): global fee in basis points, range `[0, 10000]`.
  When omitted the contract default of `50` bps (0.50 %) is used.

**Post-conditions on success:**
- `treasury` and `fee_bps` written to instance storage.
- `RoleUpdated` event emitted for `Role::Treasury`.
- `FeeUpdated` event emitted for `FeeScope::Global`.

### 3.2 Step 2: `init(admin, operator, arbitrator)`

```bash
stellar contract invoke \
  --network <NETWORK> \
  --source deployer \
  --id <CONTRACT_ID> \
  -- init \
    --admin <ADMIN_ADDRESS> \
    --operator <OPERATOR_ADDRESS> \
    --arbitrator <ARBITRATOR_ADDRESS>
```

Arguments:
- `admin` (Address): top-level authority — upgrades, role rotation. The admin
  account **must authenticate** this call.
- `operator` (Address): emergency pause / unpause, global fee updates.
- `arbitrator` (Address): dispute resolution authority.

**Post-conditions on success:**
- `admin`, `operator`, `arbitrator` written to persistent storage with a 2
  million ledger TTL.
- Three `RoleUpdated` events emitted, one per role.

### 3.3 Why ordering matters

1. `initialize` writes the **economic foundation** (treasury + global fee).
   Every milestone release, cancellation, and expired-refund path reads the
   treasury from instance storage via `get_config`. Without a treasury, any
   user action that routes fees will trap with
   `TreasuryNotInitialized = 16`.
2. `init` writes the **access-control triad** (admin / operator / arbitrator).
   These roles gate governance and emergency operations. They do not depend on
   the treasury, but deploying the access-control layer after the economic
   layer guarantees the contract can never be left in a state where an admin
   can change roles before the fee-sink is committed — a standard defence in
   depth against deployer-key compromise during the bootstrap window.
3. Both functions are **one-shot**: each returns `AlreadyInitialized = 19` on
   a second call. There is no undo short of deploying a brand-new contract.

### 3.4 What breaks if skipped or misordered

| Scenario | Failure mode |
|----------|--------------|
| Call `init` first, then try `initialize` | `init` writes `admin`; `initialize` still succeeds because it guards only on the `treasury` key. However, the resulting contract is now governed by the admin-role bearer who could rotate the treasury *before* it is set, breaking the bootstrap security invariant. |
| Skip `initialize` entirely | All fee-bearing operations (`release_milestone`, `cancel_escrow`, `refund_expired`) fail with `TreasuryNotInitialized`. Escrows can be created and deposited but never released, cancelled, or refunded — users' funds are effectively locked. |
| Skip `init` entirely | `upgrade` → `AdminNotInitialized = 18`; `set_paused` → `OperatorNotInitialized = 28`; `resolve_dispute` → `ArbitratorNotInitialized = 29`. No emergency controls exist; any bug or exploit is permanent because the upgrade path is also closed. |
| Run the same step twice | Second invocation returns `AlreadyInitialized = 19`; no state corruption, but the deployment script must handle the error idempotently and not treat it as a reason to redeploy. |

### 3.5 Post-deployment smoke checks

After both init steps succeed, verify:

```bash
# Roles
stellar contract invoke --network <NETWORK> --id <CONTRACT_ID> -- get_admin
stellar contract invoke --network <NETWORK> --id <CONTRACT_ID> -- get_operator
stellar contract invoke --network <NETWORK> --id <CONTRACT_ID> -- get_arbitrator
stellar contract invoke --network <NETWORK> --id <CONTRACT_ID> -- get_treasury

# Config
stellar contract invoke --network <NETWORK> --id <CONTRACT_ID> -- get_config
```

Confirm each returned address matches the intended deploy-time values.

---

## 4. Upgrade Procedure

The contract exposes an `upgrade(new_wasm_hash)` entrypoint that replaces the
currently-running WASM bytecode in place, preserving all on-chain state.

### 4.1 Storage layout preservation — HARD REQUIREMENT

From `lib.rs` line 15:

> ⚠️ **WARNING: Future upgrades MUST preserve storage layout (structs, enums,
> keys) to avoid corrupting state.**

Concretely this means:
- **Stored structs** (`EscrowEntryV2`, all `*Event` structs, role keys, fee
  keys, party-index chunk shape) **must not** have fields reordered, renamed,
  removed, or change type.
- **Storage key symbols** (`treasury`, `fee_bps`, `state`, `admin`, `oper`,
  `arbi`, `esc2`, `escver`, `tokfee`, `escfee`, `dispev`, `disprev`,
  `depcnt`, `reccnt`, `depchk`, `recchk`) are a **published interface**.
  Adding new keys is fine; changing or reusing existing ones is not.
- **Enum discriminants** for `EscrowStatus`, `MilestoneStatus`, `Resolution`,
  `ContractState`, and the `packed_state` bit-layout are on-the-wire encodings.
- The `ESCROW_ENTRY_STORAGE_VERSION = 2` marker defines the current storage
  schema. Any incompatible change requires a new version constant and an
  explicit migration path — it **cannot** be done by a simple `upgrade`.

### 4.2 Pre-upgrade checklist

Complete each item below before signing the upgrade call:

1. **State compatibility verification**
   - Diff the new WASM's `#[contracttype]` structs and enums against the
     currently deployed revision. Every existing field must appear at the same
     ordinal position with the same Rust type. New fields may be appended only.
   - Confirm no existing storage-key symbol was removed or repurposed.
   - Run the full test suite against a fork of mainnet/testnet state (e.g.,
     using `soroban-testutils` with captured ledger entries) including
     `release_milestone`, `resolve_dispute`, `cancel_escrow`, and
     `list_escrows_by_party` against real escrow shapes.

2. **Migration risk assessment**
   - Are there in-flight escrows in `Active`, `Created`, or `Disputed` states?
     Confirm the upgrade's binary can read and correctly advance each state.
   - Does the upgrade touch fee resolution (`fee_override_bps`, `tokfee`,
     `escfee`)? Spot-check a token-specific and an escrow-specific override.
   - Does the upgrade modify the party-index chunking? The chunk boundary is a
     persisted layout property; any code change must be backward-compatible.

3. **Versioning constraints**
   - The contract follows the semver-style policy in `README.md` (PATCH /
     MINOR / MAJOR). A MAJOR bump (breaking struct/event/storage change)
     **cannot** be performed via `upgrade` — deploy a new contract and
     orchestrate an off-chain migration instead.
   - Off-chain indexers that consume `(Vaultix, v1, ...)` events must be
     compatible with any added events or event fields. Indexer upgrades
     **must** land before the on-chain upgrade.

### 4.3 Executing the upgrade

1. Build & optimize the **new** `onchain` package:
   ```bash
   cargo build --target wasm32-unknown-unknown --release --package onchain
   stellar contract optimize --wasm target/wasm32-unknown-unknown/release/onchain.wasm
   ```
2. Install the optimized WASM and capture the new hash:
   ```bash
   stellar contract install \
     --network <NETWORK> \
     --source deployer \
     --wasm target/wasm32-unknown-unknown/release/onchain.optimized.wasm
   ```
3. Run the upgrade from the **admin** account:
   ```bash
   stellar contract invoke \
     --network <NETWORK> \
     --source admin \
     --id <CONTRACT_ID> \
     -- upgrade \
       --new-wasm-hash <NEW_WASM_HASH_HEX>
   ```
4. Post-upgrade verification: rerun the smoke checks from §3.5 and exercise a
   representative read path (`get_escrow`, `list_escrows_by_party`) and a
   low-risk write path (`update_fee`, then revert) against the upgraded
   instance.

---

## 5. Rollback / Incident Response

### 5.1 Emergency control: `set_paused(paused)`

The contract provides a coarse-grained circuit breaker via `set_paused`.

```bash
# Pause all user-facing write operations
stellar contract invoke \
  --network <NETWORK> \
  --source operator \
  --id <CONTRACT_ID> \
  -- set_paused --paused true

# Resume operations
stellar contract invoke \
  --network <NETWORK> \
  --source operator \
  --id <CONTRACT_ID> \
  -- set_paused --paused false
```

When paused (`ContractState::Paused`), the guard `ensure_not_paused` rejects
every user-mutating call with `ContractPaused = 23`:
- `create_escrow` / `create_escrows_batch`
- `deposit_funds`
- `release_milestone` / `confirm_delivery`
- `raise_dispute` / `resolve_dispute`
- `cancel_escrow`
- `complete_escrow`
- `collect_signature`
- `configure_multisig`

Read-only paths (`get_escrow`, `list_escrows_by_party`, getters) and
governance paths (`upgrade`, role setters, `set_paused` itself) are **not**
blocked so the incident response team retains control.

### 5.2 Authorized caller

Only the **operator** address (set during `init`; rotated via `set_operator`
which is admin-gated) may invoke `set_paused`. Admin, arbitrator, and treasury
do **not** have direct pause authority — role separation is intentional.

### 5.3 When to pause

Trigger `set_paused(true)` immediately when any of the following occur:

- **Confirmed or suspected exploit.** Observed behavior that matches an
  attacker-controlled invariant violation (e.g., fees not deducted,
  unauthorized milestone releases, double-spend-style patterns).
- **Critical bug discovered in code review.** A code-path bug whose on-chain
  conditions may be reachable before an upgrade ships.
- **Unsafe state detected.** Off-chain indexer or monitoring alerts showing
  `EscrowStatus` transitions that fail the `validate_status_transition`
  invariant, escrows whose `total_released > total_amount`, or fee amounts
  outside `[0, total_amount]`.
- **Protocol emergency.** Dependent infrastructure (Stellar network outage,
  trusted bridge compromise, RPC data integrity loss) where freezing user
  actions protects funds until the incident is resolved.

### 5.4 Rollback vs upgrade

`upgrade` replaces the WASM bytecode but there is **no dedicated "downgrade"
entrypoint** — rolling back is a special case of `upgrade` to a known-good
older WASM hash. Before a downgrade:
1. Confirm the older WASM's storage layout is still compatible with current
   on-chain state (see §4.1 — layout preservation applies in both directions).
2. If a new version had already written *new* storage keys that the older
   version does not understand, the older version will leave them orphaned.
   Audit for any semantic risk from orphaned keys; if present, deploy a
   patched version that preserves new-key handling rather than a pure
   downgrade.

### 5.5 Incident command checklist

1. Operator calls `set_paused(true)`. Timestamp the `PausedToggled` event.
2. Triage: reproduce against a state fork; root-cause; rate severity.
3. Build a fix candidate; pass the full pre-upgrade checklist (§4.2).
4. Admin calls `upgrade` to the fixed WASM hash.
5. Operator calls `set_paused(false)`. Announce resolution.
6. Post-mortem: publish the incident, the fix diff, and any state remediation
   performed.

---

## 6. Network Differences (reference)

| Concern | Testnet | Mainnet (Pubnet) |
|---------|---------|------------------|
| **RPC endpoint** | `https://soroban-testnet.stellar.org:443` | `https://soroban.stellar.org:443` |
| **Network passphrase** | `Test SDF Network ; September 2015` | `Public Global Stellar Network ; September 2015` |
| **Funding** | Friendbot faucet (`stellar keys fund … --network testnet`) | Transfer real XLM to the deployer; verify via `stellar keys balance … --network public` |
| **Fee model** | Minimum base fee is sufficient for all ops | Budget 2-5x base fee per op to avoid contention during high-congestion windows. Use `--fee` flag on `stellar contract deploy` / `invoke`. |
| **Deployment confirmation** | ~5-10 s; immediate RPC visibility | ~25-40 s (5-8 ledgers); poll for `transaction: success` before initializing. Some follower RPC nodes may lag an extra 1-2 ledgers. |
| **Installed WASM persistence** | Persists for the testnet reset cycle (~quarterly) | Permanent. Storage rent applies for WASM bytes and contract instance entries. |
| **Storage rent / TTL** | Same rules as mainnet but inconsequential before resets | Bump TTLs periodically for high-value role keys and large escrow corpus. Default role TTL is 2 000 000 ledgers (~230 days). |
| **Arbitrator social contract** | Test arbitrator key; acceptable to rotate frequently | Use a reputable multi-sig or institutional arbitrator; key compromise is a full breach of dispute-resolution integrity. |
| **Treasury social contract** | Test address; fees accrue to Friendbot XLM | Production hot/cold wallet policy; rotate via `set_treasury` (admin-gated). |
