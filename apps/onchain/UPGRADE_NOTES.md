# soroban-sdk upgrade: 20.0.0 → 27.0.6

Issue #571. Scope is `apps/onchain` only.

## Version bump

`apps/onchain/Cargo.toml` — both the dependency and the dev-dependency are now
pinned to the exact version:

```toml
[dependencies]
soroban-sdk = "=27.0.6"

[dev-dependencies]
soroban-sdk = { version = "=27.0.6", features = ["testutils"] }
```

Transitively this moves `soroban-env-host` 20.3.0 → 27.0.1 and `stellar-xdr`
20.1.0 → 27.0.0. `Cargo.lock` is updated accordingly.

## API changes we had to adapt to

### 1. `Env::register_contract` → `Env::register` (94 occurrences)

`register_contract(None, C)` is deprecated in favour of
`register(C, constructor_args)`. Mechanical rename across all test modules:

```rust
- let contract_id = env.register_contract(None, VaultixEscrow);
+ let contract_id = env.register(VaultixEscrow, ());
```

`VaultixEscrow` has no `#[contractimpl]` constructor, so the args tuple is `()`.

Counts: 75 in `src/test.rs` (73 live + 2 inside commented-out code), 12 in
`src/fee_tests.rs`, 5 in `src/invariant_tests.rs`, 2 in `src/upgrade_test.rs`.
Note that `src/upgrade_test.rs` and `src/types.rs` are orphan files — neither is
declared as a `mod` in `lib.rs`, so neither is compiled; `upgrade_test.rs` was
updated for consistency only.

### 2. `Env::register_stellar_asset_contract` → `..._v2` (6 call sites)

The old form is deprecated; the `_v2` form returns a `StellarAssetContract`
struct instead of a bare `Address`.

```rust
- let token_address = env.register_stellar_asset_contract(admin.clone());
+ let token_address = env.register_stellar_asset_contract_v2(admin.clone()).address();
```

### 3. `env.events().all()` return type changed

It now returns the opaque, XDR-backed `testutils::ContractEvents` instead of
`Vec<(Address, Vec<Val>, Val)>`. `ContractEvents` has no `len`/`get`/`last` and
is not an iterator, so all 15 assertion sites in `src/test.rs` broke.

Rather than rewrite every assertion, `src/test.rs` gained one private helper,
`all_events(&env)`, that converts `ContractEvents` back into the old
`Vec<(Address, Vec<Val>, Val)>` shape. Existing assertions are otherwise
unchanged.

### 4. `env.events().all()` is now scoped to the last invocation (behavioral)

**This is the only change that broke tests at runtime rather than at compile
time.** Since SDK 21 the test host's invocation meter clears the event buffer at
the start of every *top-level* contract invocation, so `all()` returns only the
events of the most recent client call. Under SDK 20 it returned every event
emitted since `Env::default()`.

Five tests relied on the old accumulating behaviour (`let events_before =
...all().len()` before a series of calls, then indexing into one long log) and
now had to assert per-call:

- `test_role_rotation_updates_roles_and_emits_audit_events` — each `set_*` call
  is now asserted immediately after its own invocation (one event each).
- `test_create_and_get_escrow`, `test_create_escrows_batch_and_get`,
  `test_raise_dispute_happy_path` — events are captured *before* the following
  `get_escrow()` read, which previously did not disturb the log.
- `test_event_topics_are_backwards_compatible` — the index-walking loop over one
  accumulated log was replaced with a per-operation
  `assert_canonical_event_topics(...)` helper. It filters to events emitted by
  the escrow contract (sub-invocations such as the token contract emit their own
  events into the same buffer) and asserts every one of them uses the canonical
  three-topic `(Vaultix, v1, EventName)` layout, plus that the expected event
  name is present.

**This affects tests only.** On-chain event emission is unchanged.

### 5. `Events::publish` is deprecated (20 call sites)

SDK 21+ deprecates `env.events().publish(topics, data)` in favour of the
`#[contractevent]` macro. We deliberately did **not** migrate: `#[contractevent]`
derives its own topic layout from the event type name, which would change the
emitted topics away from this contract's published
`(Vaultix, v1, EventName)` scheme and break off-chain indexers.

Instead, all 20 sites now route through a single private wrapper in `lib.rs`:

```rust
#[allow(deprecated)]
fn publish_event<T, D>(env: &Env, topics: T, data: D) { env.events().publish(topics, data) }
```

The `allow(deprecated)` is confined to that one function, so `clippy -D warnings`
passes and a future move to `#[contractevent]` is a single-site change.

### 6. Build target changed: `wasm32-unknown-unknown` → `wasm32v1-none`

**Most operationally significant change — it breaks any existing build/deploy
script verbatim.** soroban-sdk 27's `build.rs` hard-panics when built for
`wasm32-unknown-unknown` on Rust 1.82+:

> Rust compiler 1.82+ with target 'wasm32-unknown-unknown' is unsupported by the
> Soroban Environment, use 'wasm32v1-none' available with Rust 1.84+. The
> 'wasm32-unknown-unknown' target in Rust 1.82+ has features enabled that are not
> yet supported and not easily disabled: reference-types, multi-value.

So the release build is now:

```sh
rustup target add wasm32v1-none
cargo build --target wasm32v1-none --release
# output: target/wasm32v1-none/release/onchain.wasm
```

Updated in this PR:

- `.github/workflows/contract-ci.yml` — installed target.
- root `README.md` — three occurrences in the setup/troubleshooting sections.

**Still needs updating (left alone deliberately — being edited in parallel):**
`docs/contract/README.md` has four references to `wasm32-unknown-unknown`,
including the `soroban contract optimize` and `soroban contract deploy` paths
(`target/wasm32-unknown-unknown/release/vaultix_escrow.wasm`). Those must move to
`target/wasm32v1-none/release/...` or deploys will use a stale/absent artifact.

### 7. Pre-existing clippy failure fixed

Not caused by the upgrade, but `cargo clippy -- -D warnings` was already failing
on current stable rustc with `collapsible_match` in
`src/invariants.rs::validate_status_field_consistency`. Rewritten as a match
guard (semantically identical) so CI is green.

### 8. Test snapshots regenerated

All 93 files under `test_snapshots/` were rewritten. This is `stellar-xdr`'s JSON
encoding changing (`i128`/`u64`/`seq_num` now serialize as strings, entries gained
a `mux_id` generator field and a named `live_until` field), not a change in
contract behaviour.

## TTL: reviewed, no change required

`extend_roles_ttl` and `extend_escrow_ttl` (and `escrow_ttl_max` /
`seconds_to_ledgers`) were checked against the new host and left as-is:

- `Persistent::extend_ttl(key, threshold, extend_to)` keeps the same signature
  and the same argument order.
- Test-env ledger defaults are identical across both SDKs:
  `min_persistent_entry_ttl: 4096`, `min_temp_entry_ttl: 16`,
  `max_entry_ttl: 6_312_000`.
- Overshoot handling is unchanged: for **persistent** entries the host still
  clamps `extend_to` to the network max rather than erroring (only *temporary*
  entries error). Our largest `extend_to` is 2_000_000, well under 6_312_000.
- The `threshold > extend_to` guard still errors; our threshold is always 100,
  which is below every `extend_to` we pass.

Verified empirically against the regenerated snapshots: every contract-owned
persistent entry (`esc2`, `escver`, `depidx`, `recidx`, `tokfee`, and the
contract instance) has the **identical** `live_until` under SDK 27 as under SDK
20. The only TTL deltas in the snapshots are in entries the contract does not
control: auth nonce entries created by `mock_all_auths` now expire at the max
entry TTL rather than the min temporary TTL (15 → 6311999 — a testutils
signature-expiry detail), and the built-in SAC allowance entry shifted by one
ledger (201 → 200).

## Redeploy notes

- **No storage migration needed.** No storage key, struct, enum, or
  `contracttype` layout changed, and the existing `EscrowEntryV2` /
  `ESCROW_ENTRY_STORAGE_VERSION` migration path is untouched. Existing persistent
  entries stay readable.
- **No event-schema change.** Topics and payload types are byte-identical, so
  off-chain indexers need no changes.
- **Build with the new target.** Rebuild with
  `cargo build --target wasm32v1-none --release` (see change #6) and push
  `target/wasm32v1-none/release/onchain.wasm` through the existing
  `upgrade(new_wasm_hash)` admin path. Any deploy script or CI job still pointing
  at `target/wasm32-unknown-unknown/release/` will silently pick up a stale
  artifact or fail outright.
- The contract now targets a newer protocol version; make sure the target network
  (testnet/mainnet) is on a protocol the SDK 27 host supports before upgrading.

## Verification

All green from `apps/onchain/`:

- `cargo build`
- `cargo test` — 108 passed, 0 failed
- `cargo fmt --all -- --check`
- `cargo clippy --all-targets --all-features -- -D warnings`
- `cargo build --target wasm32v1-none --release` — 60,456 byte
  `onchain.wasm`, and `stellar contract info interface --wasm ...` reads the
  spec back cleanly.

One note for whoever deploys: the local `stellar` CLI here is 26.0.0. It parses
the SDK 27 wasm fine, but bump the CLI to 27.x before an actual
optimize/deploy against a network.
