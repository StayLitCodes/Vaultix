# Contract Deployment and Upgrade Runbook

This runbook describes the current `apps/onchain` Soroban contract. The
package is named `onchain`, so the release artifact is `onchain.wasm`—not
`vaultix_escrow.wasm`.

## 1. Prerequisites

Install the pinned Rust target and Stellar CLI, then verify that the account
used to sign transactions is funded on the selected network:

```bash
rustup target add wasm32v1-none
cargo install --locked stellar-cli --version 26.0.0
stellar keys address deployer
```

The deployer needs enough native balance for upload, deployment, and invoke
fees. On testnet, fund it with the network friendbot. Never put a secret key
in a command, shell history, workflow input, or committed file; store it in
the CLI keychain or a protected CI secret.

## 2. Build and optimize

Run these commands from `apps/onchain`:

```bash
cargo build --target wasm32v1-none --release
stellar contract optimize \
  --wasm target/wasm32v1-none/release/onchain.wasm \
  --wasm-out target/wasm32v1-none/release/onchain.optimized.wasm
```

Confirm the artifact exists, review the source diff, and run the repository's
formatting and test checks before deployment.

## 3. Fresh deployment and initialization

The current contract uses the atomic `__constructor` at deployment time. It
sets `admin`, `operator`, `arbitrator`, `treasury`, and `fee_bps` in one
transaction, eliminating the permissionless-initializer window present in
older versions.

Deploy the optimized artifact with the constructor arguments required by the
contract (confirm exact argument spelling with `stellar contract deploy
--help` for the installed CLI):

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/onchain.optimized.wasm \
  --network testnet \
  --source-account deployer \
  -- \
  --admin G_ADMIN \
  --operator G_OPERATOR \
  --arbitrator G_ARBITRATOR \
  --treasury G_TREASURY \
  --fee_bps 50
```

Record the returned contract ID and verify initialization:

```bash
stellar contract invoke --id C_CONTRACT \
  --network testnet --source-account deployer -- is_initialized
stellar contract invoke --id C_CONTRACT \
  --network testnet --source-account deployer -- get_admin
stellar contract invoke --id C_CONTRACT \
  --network testnet --source-account deployer -- get_operator
stellar contract invoke --id C_CONTRACT \
  --network testnet --source-account deployer -- get_config
```

### Legacy `initialize` / `init` terminology

Older deployment notes described two calls, `initialize` for treasury and fee
followed by `init` for admin, operator, and arbitrator. That API was replaced
by `__constructor` in issue #621. New deployments must not call either legacy
entrypoint: they are not exported by the current contract and the invocation
will fail as an unknown function. A deployment that skips constructor
arguments is not partially initialized; protected operations return
`ContractNotInitialized` or a role-specific initialization error. The safe
remedy is to redeploy with complete constructor arguments.

For an already deployed legacy instance, do not guess at a migration order.
Confirm its version and storage layout with the maintainer, back up the
deployment record, and use a reviewed migration or a fresh deployment. Never
run `initialize` and `init` out of order on an old instance: the first
successful call may make the second fail with an initialization error, while a
partially configured instance can leave fee or role operations unavailable.

## 4. Upgrade procedure

`upgrade` is an admin-only entrypoint:

```bash
WASM_HASH=$(stellar contract upload \
  --wasm target/wasm32v1-none/release/onchain.optimized.wasm \
  --network testnet --source-account deployer)

stellar contract invoke --id C_CONTRACT \
  --network testnet --source-account deployer -- \
  upgrade --new_wasm_hash "$WASM_HASH"
```

The signer must be the stored admin. An upgrade keeps the contract ID and
existing storage, roles, escrows, and balances. Future WASM must preserve all
stored keys, structs, enum encodings, and migration assumptions in
`apps/onchain/src/lib.rs`.

### Pre-upgrade checklist

1. Review the contract diff and generated interface/spec for breaking changes.
2. Confirm every existing storage key and encoded type remains readable, or
   ship and test an explicit migration first.
3. Run invariant, authorization, upgrade, formatting, and full test checks.
4. Deploy and exercise the exact WASM on testnet before mainnet.
5. Confirm the signer is the current admin and preserve a rollback artifact.
6. Notify indexer and client owners about event or entrypoint changes.

## 5. Emergency pause and rollback

The operator—not an arbitrary deployer—controls the emergency circuit breaker:

```bash
stellar contract invoke --id C_CONTRACT \
  --network testnet --source-account operator -- \
  set_paused --paused true
```

Use `set_paused false` only after the operator confirms that the incident is
contained. Keep admin, operator, and arbitrator responsibilities separate in
production; a testnet may intentionally use one account for all roles.

Soroban has no automatic rollback. To roll back logic, rebuild the last
known-good commit, optimize it, upload it, and call `upgrade` with the current
admin. This preserves state but does not undo already-executed transactions.
If the storage layout is unsafe, pause the contract, deploy a new instance,
migrate only with a reviewed plan, and update every client and indexer to the
new contract ID instead of attempting an unsafe in-place rollback.

## 6. Testnet versus mainnet

- **Network and passphrase:** use `--network testnet` only for testnet. Mainnet
  requires the production network configuration and passphrase; never reuse a
  testnet secret or endpoint.
- **RPC and Horizon:** verify the CLI's configured RPC and Horizon endpoints
  before signing. A successful submission on one network does not prove that
  the contract exists on the other.
- **Funding:** testnet accounts can use friendbot; mainnet deployers require
  funded production accounts and an approved fee budget.
- **Keys and approvals:** keep production secrets in a hardware-backed or
  protected CI secret store and require maintainer approval for deployment and
  upgrade workflows.

## 7. Deployment record

Record the contract ID, network, source commit, optimized WASM hash, timestamp,
signer identity, mode, and any migration or rollback decision. The repository's
`apps/onchain/deployments/testnet.json` is suitable for testnet records;
production records must use the project's approved protected registry.

## 8. Testnet deploy workflow (GitHub Actions)

`.github/workflows/testnet-deploy.yml` ("Testnet Deploy") automates sections
2–4 and 7 for **testnet only**. It never runs on push or pull request.

### Prerequisites

- Repository secret `STELLAR_TESTNET_DEPLOYER_SECRET_KEY`: the deployer's
  `S...` secret key. The workflow pipes it to `stellar keys add --secret-key`
  over stdin and never echoes it; GitHub additionally masks it in logs. The
  job fails early with a clear error if the secret is missing.
- For `upgrade`, the deployer key must be the contract's current **admin**
  (`upgrade` is admin-only).
- The workflow commits the registry back to the dispatched branch, so it needs
  `contents: write` (declared in the workflow) and a branch that allows the
  `github-actions[bot]` push.

### Triggering

GitHub → **Actions** → **Testnet Deploy** → **Run workflow**, pick the branch,
then set the inputs:

| Input | Used by | Meaning |
| --- | --- | --- |
| `mode` | both | `deploy` (new contract instance) or `upgrade` (new WASM on an existing id). |
| `existing_contract_id` | `upgrade` | `C...` id to upgrade. Required for `upgrade`. |
| `operator_address`, `arbitrator_address`, `treasury_address` | `deploy` | `G...` role addresses; default to the deployer's address when blank. |
| `fee_bps` | `deploy` | Initial global fee in basis points (default `50`). |

Equivalent CLI trigger: `gh workflow run testnet-deploy.yml --ref <branch> -f
mode=upgrade -f existing_contract_id=C...`.

### What a run does

1. Builds `onchain.wasm` for `wasm32v1-none` and optimizes it.
2. Funds the deployer via friendbot (non-fatal if already funded).
3. Uploads the optimized WASM and captures its hash.
4. `deploy`: creates a new instance. `upgrade`: calls the existing contract's
   `upgrade(new_wasm_hash)` — roles, escrows and balances are preserved.
5. Smoke check: invokes `get_admin` and `get_config`; any failure fails the
   job, so an unreachable or uninitialized contract never gets recorded.
6. Writes `contract_id`, `wasm_hash`, `network`, `commit_sha`, `deployed_at`
   and `mode` to `apps/onchain/deployments/testnet.json` and commits it to the
   dispatched branch. A committed `null` registry means no recorded deploy yet.

### Known limitation: `deploy` mode predates `__constructor`

The `deploy` path still runs `stellar contract deploy` **without** constructor
arguments and then invokes the legacy `init` / `initialize` entrypoints, which
no longer exist (see section 3). Until the workflow is updated to pass
`--admin/--operator/--arbitrator/--treasury/--fee_bps` to the constructor,
`mode=deploy` will fail. Meanwhile:

- Create new instances manually with section 3 (constructor args in the same
  deploy transaction — never deploy first and initialize later), then record
  the result in `deployments/testnet.json` per section 7.
- Use the workflow's `mode=upgrade` against that contract id for subsequent
  releases; this path is unaffected.

### Rollback with the workflow

Re-run **Testnet Deploy** with `mode=upgrade`, the same
`existing_contract_id`, and the **last known-good commit/branch** selected as
the ref. This rebuilds and uploads that WASM and upgrades back to it, then
records the rollback in the registry (the previous entry remains in git
history). The section 5 caveats apply: state is preserved, executed
transactions are not undone, and an unsafe storage change needs a new
instance instead.
