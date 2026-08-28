# Testnet Deployment Runbook

This document covers the manually-triggered `Testnet Deploy` GitHub Actions
workflow (`.github/workflows/testnet-deploy.yml`), which builds, optimizes,
and deploys (or upgrades) the `onchain` Soroban contract on Stellar testnet,
initializes roles, runs a post-deploy smoke check, and records the result in
[`apps/onchain/deployments/testnet.json`](../../apps/onchain/deployments/testnet.json).

For manual local deployment steps (no CI), see the "Deployment Instructions"
section of [`README.md`](./README.md). This document is specifically about
the automated workflow.

## Triggering the workflow

1. Go to the repository's **Actions** tab.
2. Select **Testnet Deploy** in the left-hand workflow list.
3. Click **Run workflow**.
4. Choose the branch to run from (the workflow checks out and, at the end,
   commits back to whichever branch you pick here).
5. Fill in the inputs:
   - **mode** — `deploy` to install the wasm and create a brand-new contract
     instance (this also initializes roles). `upgrade` to install the wasm
     and call the existing contract's own `upgrade()` entrypoint against an
     already-deployed contract (no re-initialization).
   - **existing_contract_id** — the `C...` contract id to upgrade. Required
     only when mode is `upgrade`; the workflow fails fast with a clear error
     if it's missing in that case.
   - **treasury_address** / **operator_address** / **arbitrator_address**
     (deploy mode only) — `G...` addresses for those roles. Leave blank to
     default all three to the deployer account's own address, which is fine
     for a testnet smoke-test deployment but not appropriate if you want
     distinct role holders.
   - **fee_bps** (deploy mode only) — initial platform fee in basis points,
     defaults to `50`.
6. Click **Run workflow** and watch the job. Each stage (build, optimize,
   deploy/upgrade, role init, smoke check, registry commit) is its own step
   in the log.

## Required secrets

Configure these under **Settings → Secrets and variables → Actions** for the
repository (or environment, if you gate this workflow behind a GitHub
Environment):

| Secret | Purpose |
| --- | --- |
| `STELLAR_TESTNET_DEPLOYER_SECRET_KEY` | The `S...` secret key of the testnet account used to sign every transaction the workflow submits (upload, deploy, upgrade, role-init, invoke calls). This account pays the network fees, so it must be funded on testnet — the workflow attempts to fund it via friendbot automatically, but that step is best-effort and won't block the run if the account is already funded. |

This key doubles as the contract **admin** key for a fresh `deploy` (the
workflow passes the deployer's own address as `admin` to the contract's
`init` entrypoint, unless a different admin-holding flow is introduced
later). For `upgrade` mode, this same key must already be the contract's
admin, since `upgrade()` requires the admin's authorization
(`admin.require_auth()`), or the invoke step will fail.

The workflow only ever references this secret through `${{ secrets.* }}`
piped into `env:` blocks, and passes it to the CLI via `stdin`
(`stellar keys add --secret-key`) rather than as a command-line argument, so
it never appears in a command line that gets echoed to the log. GitHub
Actions also automatically masks any log output that matches a registered
secret's value, as an additional safety net.

No secret is needed for `GITHUB_TOKEN` — the workflow uses the
automatically-provided token (via `permissions: contents: write`) to push
the registry-file commit at the end.

## What gets recorded

On success, the workflow overwrites
[`apps/onchain/deployments/testnet.json`](../../apps/onchain/deployments/testnet.json)
with:

```json
{
  "contract_id": "C...",
  "wasm_hash": "...",
  "network": "testnet",
  "commit_sha": "the commit the wasm was built from",
  "deployed_at": "UTC ISO-8601 timestamp",
  "mode": "deploy | upgrade"
}
```

...and commits that file directly to the branch the workflow ran from,
authored as `github-actions[bot]`. Because this file is tracked in git,
every past deployment/upgrade is recoverable from its commit history
(`git log -p -- apps/onchain/deployments/testnet.json`).

We push directly rather than opening a PR: the workflow is already
human-triggered and the file is an append-only record of infrastructure
facts (contract id, wasm hash, timestamp) rather than source code that
benefits from review. If your team later wants an approval gate on
deployments, the simplest change is to add a required review to a GitHub
Environment this job runs under — not to route this specific commit through
a PR.

## Rollback

Soroban contracts have no automatic rollback primitive beyond the
admin-gated `upgrade()` entrypoint the contract itself exposes — there is no
built-in "revert to previous wasm" operation. To roll back a bad upgrade:

1. Find the last known-good deployment in `testnet.json`'s git history:
   ```bash
   git log -p -- apps/onchain/deployments/testnet.json
   ```
   Identify the `wasm_hash` and `commit_sha` of the last version you trust.
2. Re-run the **Testnet Deploy** workflow with:
   - **mode**: `upgrade`
   - **existing_contract_id**: the same contract id (rollback upgrades the
     wasm in place; the contract id and its storage/roles are untouched)
   - Check out (or otherwise rebuild from) the historical `commit_sha` so the
     workflow rebuilds and re-uploads that same known-good wasm, then
     upgrades the live contract back to it.

   In practice this means running the workflow from a branch/tag pointing at
   that commit, since the workflow always builds from the checked-out
   source rather than re-uploading a previously-recorded `wasm_hash`
   directly.
3. If the contract's storage layout itself was the problem (not just logic),
   an in-place upgrade may not be safe — in that case the safer path is a
   fresh `deploy` of a new contract instance and updating downstream
   consumers (frontend/backend config, other contracts holding this
   contract's id) to point at the new contract id instead of trying to
   "undo" state in the old one.

## Unrelated: metadata hash / CID convention

The "Metadata Hash Interop" section in [`README.md`](./README.md) (how
`create_escrow`'s `metadata_hash` field maps to IPFS CIDs) is unrelated to
this deployment workflow and untouched by it — it documents an on-chain data
convention, not a deployment step.
