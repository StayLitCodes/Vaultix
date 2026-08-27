# VaultixEscrow Contract Overview

## High-Level Purpose
The `VaultixEscrow` contract is a decentralized, milestone-based escrow system built on the Soroban network. It facilitates secure transactions between two parties (a depositor and a recipient). Funds are locked into the contract and released incrementally upon the completion of predefined milestones. The contract includes dispute resolution, emergency pausing, and platform fee capabilities to provide a robust on-chain trust mechanism.

## Deployment Instructions

For the complete production runbook including build, deployment, role
initialization ordering, upgrade, and emergency pause/rollback procedures see
[`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Roles

The contract defines several key roles, each with specific permissions:

- **Admin**: The top-level authority capable of upgrading the contract's Wasm code and initializing the contract with operator and arbitrator roles.
- **Operator**: Authorized to pause and unpause the contract during emergencies, acting as a circuit breaker. Can also update the global platform fee.
- **Treasury**: The recipient of platform fees deducted during milestone releases or escrow cancellations. The treasury can also set specific fee overrides for individual tokens or escrows.
- **Arbitrator**: A trusted third party authorized to resolve disputes between the depositor and recipient, deciding how funds are distributed.
- **Depositor**: The user who creates the escrow, funds it with tokens, and has the authority to release milestones (or confirm delivery) to the recipient.
- **Recipient**: The user designated to receive the funds upon the completion of milestones.

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
