# VaultixEscrow Contract Overview

> **Documentation index:** [DATA_MODELS.md](DATA_MODELS.md) · [EVENTS.md](EVENTS.md) · [ERRORS.md](ERRORS.md) · [WORKFLOWS.md](WORKFLOWS.md) · [DEPLOYMENT.md](DEPLOYMENT.md)

## High-Level Purpose
The `VaultixEscrow` contract is a decentralized, milestone-based escrow system built on the Soroban network. It facilitates secure transactions between two parties (a depositor and a recipient). Funds are locked into the contract and released incrementally upon the completion of predefined milestones. The contract includes dispute resolution, emergency pausing, and platform fee capabilities to provide a robust on-chain trust mechanism.

## Deployment Instructions

### Environment Setup
Ensure you have the Stellar CLI and correct Rust toolchain installed:
```bash
rustup target add wasm32v1-none
cargo install --locked stellar-cli
```

### Build
To build the smart contract into a `.wasm` file:
```bash
cargo build --target wasm32v1-none --release
```
Optimization (Optional but recommended):
```bash
stellar contract optimize --wasm target/wasm32v1-none/release/onchain.wasm
```

### Deploy
Deploy the optimized `.wasm` file to the network:
```bash
stellar contract deploy --wasm target/wasm32v1-none/release/onchain.optimized.wasm --network testnet \
    --source YOUR_ACCOUNT_SECRET
```

For an automated, CI-driven alternative to the manual steps above (including
role initialization, a post-deploy smoke check, and a committed deployment
registry), see [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Roles

The contract defines several key roles, each with specific permissions:

- **Admin**: The top-level authority capable of upgrading the contract's Wasm code and initializing the contract with operator and arbitrator roles.
- **Operator**: Authorized to pause and unpause the contract during emergencies, acting as a circuit breaker. Can also update the global platform fee.
- **Treasury**: The recipient of platform fees deducted during milestone releases or escrow cancellations. The treasury can also set specific fee overrides for individual tokens or escrows.
- **Arbitrator**: A trusted third party authorized to resolve disputes between the depositor and recipient, deciding how funds are distributed.
- **Depositor**: The user who creates the escrow, funds it with tokens, and has the authority to release milestones (or confirm delivery) to the recipient.
- **Recipient**: The user designated to receive the funds upon the completion of milestones.

## Admin Transfer (Two-Step Handshake)

The admin is the only role that can upgrade the contract, rotate the operator /
arbitrator / treasury roles, and (through the operator) pause the contract.
Losing the admin key permanently locks the contract's governance, so the admin
role is transferred with a propose/accept handshake instead of a single
`set_admin` call (issue #570).

- `propose_admin(new_admin)` — called by the **current admin**. Stores
  `new_admin` as a *pending* proposal under the `admprop` storage key and emits
  an `AdminProposed` event. **The current admin remains fully in force.**
  Proposing again replaces any existing pending proposal and restarts its
  window.
- `accept_admin()` — called by the **pending admin**. Requires authentication
  from the pending admin (proving control of that key) and only then promotes
  them, emitting the existing `RoleUpdated` event. The proposal is consumed.
- `cancel_admin_proposal()` — called by the **current admin** to withdraw a
  pending proposal, emitting an `AdminProposalCancelled` event.
- `get_pending_admin()` — view returning `Option<AdminProposal>` (the pending
  `new_admin` address and its `expires_at` ledger timestamp).

### Expiry window

A pending proposal expires `ADMIN_PROPOSAL_WINDOW_SECS` (7 days / 604,800
ledger seconds) after it is proposed. `accept_admin` only succeeds while the
current ledger timestamp is within the window; once the window elapses the
proposal becomes inert and can never be accepted, and the current admin
remains in force. The stale entry stays stored (so callers can see it lapsed)
until the current admin withdraws it with `cancel_admin_proposal` or replaces
it with a new `propose_admin` call.

### Breaking change

`set_admin(new_admin)` is **no longer an immediate transfer**. It now delegates
to `propose_admin`, so the admin role only changes once the proposed address
proves control of its key by calling `accept_admin`. Existing tooling that
calls `set_admin` keeps compiling but the semantics changed: a single
`set_admin` transaction can no longer lock the contract out, and it also no
longer takes effect until the new admin accepts. New integrations should call
`propose_admin` directly.

## Metadata Hash Interop

`create_escrow` stores a `metadata_hash` as `BytesN<32>`. The canonical meaning of that field is the raw 32-byte `sha2-256` digest of the escrow metadata reference.

- On-chain form: raw 32 bytes.
- API/client form: lowercase 64-character hex string of those same 32 bytes.
- Display form: prefer `ipfs://<cid>` for users.
- CID mapping: when metadata is pinned to IPFS, decode the CID multihash and extract the `sha2-256` digest bytes. New writes should prefer CIDv1 base32.
- Validation: the contract rejects the all-zero digest, and off-chain clients reject malformed hex/CID inputs.

## Dispute Evidence Hash Interop

`raise_dispute` takes a required `evidence_hash` and `resolve_dispute` takes an optional `resolution_evidence_hash`, both `BytesN<32>`. They follow the **identical** convention and encoding as `metadata_hash` above (raw 32-byte `sha2-256` digest on chain, lowercase 64-character hex off chain, digest bytes extracted from the IPFS CID multihash, all-zero digest rejected with `InvalidMetadataHash`) — see [Metadata Hash Interop](#metadata-hash-interop) for the full rules.

Dispute-specific notes:

- **One digest per dispute.** The contract stores a single `BytesN<32>` per escrow, so when a dispute is backed by multiple evidence files the backend must anchor a bundle rather than an individual file: it builds a deterministic JSON manifest `{"cids": [...]}` with the CIDs sorted lexicographically and no insignificant whitespace, pins that manifest, and submits the manifest's own `sha2-256` digest on chain. A single-file dispute may submit that file's digest directly.
- **Storage.** The digest is not part of the escrow record; it lives in its own escrow-id-keyed persistent entry (`dispev` for the raiser's evidence, `disprev` for the arbitrator's), read back via `get_dispute_evidence(escrow_id)` and `get_dispute_resolution_evidence(escrow_id)`.
- **Absence.** `get_dispute_evidence` returns `DisputeEvidenceNotFound` for an escrow that was never disputed, and `EscrowNotFound` for an unknown id. `get_dispute_resolution_evidence` returns `None` when the arbitrator supplied no ruling document — resolution evidence is optional and omitting it is a fully supported path. `DisputeResolvedEvent.resolution_evidence_hash` is itself an `Option<BytesN<32>>`, so that absence is carried through to the event payload as `None`.

## Contract Spec Artifact & Binding Regeneration

The contract interface is exported as a Soroban contract specification artifact to keep off-chain clients in sync.

### Regenerate contract bindings

From the `apps/onchain` directory run:
```bash
./scripts/generate_contract_spec.sh
```

This command builds the Wasm contract and emits the current contract metadata/spec artifact to `target/contract-spec`.

### CI export

The GitHub Actions flow now exports the contract spec artifact as a build artifact so reviewers and downstream systems can verify interface compatibility.

## Public Interface Versioning Policy

The `VaultixEscrow` contract follows a semver-style compatibility policy for public entrypoints and on-chain types:

- `PATCH` — Internal bug fixes, performance improvements, or contract behavior changes that do not alter public entrypoint signatures, event schemas, or stored type encodings.
- `MINOR` — Additive changes such as new public entrypoints, new optional fields in structs/events, or new storage keys while preserving existing query formats.
- `MAJOR` — Any breaking change to existing public entrypoint signatures, existing event payloads/types, or stored state layout for active on-chain entries.

Breaking changes require an on-chain upgrade plan, explicit migration or version marker support, and off-chain client updates.

## Event Schema Changes

### `ContractUpgraded`, `MultisigConfigured`, `SignatureCollected` now use the versioned topic (Issue #569)

These three events previously bypassed the shared `event_topic()` helper:
`ContractUpgraded` published a two-part topic missing the schema-version
segment, and `MultisigConfigured`/`SignatureCollected` put `escrow_id` in the
topic's third slot instead of the schema version. All three now publish via
`event_topic()`, so every lifecycle event uses the identical canonical
`(Vaultix, v1, EventName)` three-topic tuple. `escrow_id` moved into the data
payload for the latter two: `MultisigConfigured` data is now `(escrow_id,
threshold_amount, required_signatures)`, and `SignatureCollected` data is now
`(escrow_id, signer)`.

**This is a breaking event-schema change for these three events only.**
Off-chain indexers filtering on the old topic shapes for these three events
must be updated in step with this contract upgrade.