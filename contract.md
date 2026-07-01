# Vaultix Smart Contract (Soroban) Issues - Wave 3

Below are 10 new issues identified for the Vaultix Soroban smart contract to enhance security, scalability, and user experience.

---

### 1. [Feature] Implement Multi-Signature Approval for High-Value Escrows
**Label:** `enhancement`, `security`
**Complexity:** 200 points
**Description:**
Add a threshold-based multi-signature requirement for releasing funds. If an escrow amount exceeds a configurable threshold, both the buyer and a designated third party (or two-out-of-three) must sign the release transaction.
**Tasks:**
- [ ] Add `threshold` and `required_signatures` to the `Escrow` struct.
- [ ] Implement a `collect_signature` function to store approvals.
- [ ] Update `release_milestone` to check if requirements are met.

### 2. [Optimization] Dynamic Tier-Based Fee Structure
**Label:** `optimization`, `finance`
**Complexity:** 150 points
**Description:**
Replace the static `fee_bps` with a dynamic tier system. As the total volume handled by an escrow (or globally for a user) increases, the platform fee percentage should decrease.
**Tasks:**
- [ ] Define fee tiers (e.g., 0-1000 XLM: 50bps, 1000-5000 XLM: 30bps).
- [ ] Implement a `calculate_tiered_fee` helper function.
- [ ] Update fee resolution logic to use tiers.

### 3. [Feature] IPFS Metadata Storage for Escrow Agreements
**Label:** `feature`, `decentralization`
**Complexity:** 200 points
**Description:**
Add a `metadata_hash` field to the `Escrow` struct. This allows users to link a decentralized agreement (stored on IPFS) directly to the on-chain escrow, ensuring transparency and immutability of terms.
**Tasks:**
- [ ] Update `Escrow` struct with `metadata_hash: BytesN<32>`.
- [ ] Modify `create_escrow` to accept this hash.
- [ ] Update events to include the metadata link.

### 4. [Refactor] Enhanced Storage Management & Rent Optimization
**Label:** `refactor`, `gas-optimization`
**Complexity:** 150 points
**Description:**
Optimize the persistent storage usage. Currently, we use several keys for a single escrow. We should investigate struct packing and more granular TTL management to minimize rent costs.
**Tasks:**
- [ ] Audit all `env.storage().persistent().set` calls.
- [ ] Pack related status fields into bitmasks if possible.
- [ ] Refine `extend_ttl` strategy for different storage types.

### 5. [Feature] Secure Milestone Re-negotiation Mechanism
**Label:** `feature`, `governance`
**Complexity:** 200 points
**Description:**
Allow both parties to propose and accept changes to pending milestones (amount or description) after the escrow is active but before release.
**Tasks:**
- [ ] Implement `propose_milestone_change`.
- [ ] Implement `accept_milestone_change`.
- [ ] Ensure security checks prevent unauthorized changes.

### 6. [Feature] Time-Locked Dispute Resolution Defaulting
**Label:** `feature`, `dispute`
**Complexity:** 200 points
**Description:**
Add a deadline for arbitrators to resolve disputes. If no resolution is reached within X days, apply a default action (e.g., split funds 50/50 or refund the depositor).
**Tasks:**
- [ ] Add `dispute_deadline` to the `Escrow` struct.
- [ ] Implement a `trigger_default_resolution` function.
- [ ] Update `raise_dispute` to set the deadline.

### 7. [Feature] Batch Escrow Creation Support
**Label:** `performance`, `ux`
**Complexity:** 150 points
**Description:**
Allow bulk creation of escrows in a single transaction. This is crucial for high-volume users (e.g., e-commerce platforms) to reduce gas overhead and complexity.
**Tasks:**
- [ ] Create `create_escrows_batch` function.
- [ ] Implement loop logic with atomicity (all succeed or all fail).
- [ ] Optimize event emission for batches.

### 8. [Security] Emergency Pause Circuit Breaker Extension
**Label:** `security`, `admin`
**Complexity:** 200 points
**Description:**
Enhance the existing `set_paused` mechanism. Add a "drain" or "rescue" function for admins to recover funds from a compromised contract to a secure multisig treasury.
**Tasks:**
- [ ] Implement `emergency_withdraw` with time-lock protection.
- [ ] Add granular pause states (e.g., `PauseDepositsOnly`).
- [ ] Document the governance process for emergency actions.

### 9. [Feature] Partial Milestone Releases
**Label:** `enhancement`, `flexibility`
**Complexity:** 150 points
**Description:**
Enable releasing a specific percentage of a milestone based on mutual agreement. This supports "Work-in-Progress" payments without needing to split milestones manually.
**Tasks:**
- [ ] Modify `release_milestone` to accept a `percentage`.
- [ ] Update accounting to track partial releases.
- [ ] Ensure fee calculation is proportional.

### 10. [UX] Improved Error Reporting with Detailed Context
**Label:** `ux`, `developer-experience`
**Complexity:** 100 points
**Description:**
Expand the `Error` enum and emit more descriptive events for failed operations. Provide better feedback to the frontend when a transaction is rejected.
**Tasks:**
- [ ] Add more granular error variants (e.g., `MilestoneAmountExceedsTotal`).
- [ ] Emit `OperationFailed` events with context before returning `Err`.
- [ ] Standardize error codes across all functions.
