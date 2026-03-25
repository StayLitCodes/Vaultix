# VaultixEscrow Contract Overview

## High-Level Purpose
The `VaultixEscrow` contract is a decentralized, milestone-based escrow system built on the Soroban network. It facilitates secure transactions between two parties (a depositor and a recipient). Funds are locked into the contract and released incrementally upon the completion of predefined milestones. The contract includes dispute resolution, emergency pausing, and platform fee capabilities to provide a robust on-chain trust mechanism.

## Deployment Instructions

### Environment Setup
Ensure you have the Soroban CLI and correct Rust toolchain installed:
```bash
rustup target add wasm32-unknown-unknown
cargo install --locked soroban-cli
```

### Build
To build the smart contract into a `.wasm` file:
```bash
cargo build --target wasm32-unknown-unknown --release
```
Optimization (Optional but recommended):
```bash
soroban contract optimize --wasm target/wasm32-unknown-unknown/release/vaultix_escrow.wasm
```

### Deploy
Deploy the optimized `.wasm` file to the network:
```bash
soroban contract deploy --wasm target/wasm32-unknown-unknown/release/vaultix_escrow.optimized.wasm --network testnet \
    --source YOUR_ACCOUNT_SECRET
```

## Roles

The contract defines several key roles, each with specific permissions:

- **Admin**: The top-level authority capable of upgrading the contract's Wasm code and initializing the contract with operator and arbitrator roles.
- **Operator**: Authorized to pause and unpause the contract during emergencies, acting as a circuit breaker. Can also update the global platform fee.
- **Treasury**: The recipient of platform fees deducted during milestone releases or escrow cancellations. The treasury can also set specific fee overrides for individual tokens or escrows.
- **Arbitrator**: A trusted third party authorized to resolve disputes between the depositor and recipient, deciding how funds are distributed.
- **Depositor**: The user who creates the escrow, funds it with tokens, and has the authority to release milestones (or confirm delivery) to the recipient.
- **Recipient**: The user designated to receive the funds upon the completion of milestones.
