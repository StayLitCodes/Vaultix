# Stellar Service Integration

This document describes the Stellar blockchain integration implemented in the Vaultix backend.

## Overview

The Stellar service provides a bridge between the off-chain escrow system and the Stellar blockchain, enabling secure on-chain transactions for escrow operations.

## Components

### 1. Configuration (`src/config/stellar.config.ts`)

Manages Stellar network configuration including:
- Network selection (testnet/mainnet)
- Horizon URL
- Network passphrase
- Wallet secrets
- Timeout and retry settings

### 2. Core Service (`src/services/stellar.service.ts`)

Provides core Stellar functionality:
- Account information retrieval
- Transaction building for escrow operations
- Transaction submission with retry logic
- Transaction status monitoring
- Key validation and generation

### 3. Escrow Operations (`src/services/stellar/escrow-operations.ts`)

Specialized operations for escrow functionality:
- Escrow initialization
- Funding operations
- Milestone releases
- Confirmation operations
- Cancel and completion operations

### 4. Retry Utility (`src/utils/retry.util.ts`)

Implements exponential backoff retry logic for network resilience.

### 5. Module Integration (`src/modules/stellar/stellar.module.ts`)

NestJS module that bundles Stellar services for dependency injection.

### 6. Escrow Integration (`src/modules/escrow/services/escrow-stellar-integration.service.ts`)

Bridges the escrow business logic with Stellar blockchain operations:
- Creating on-chain escrows
- Funding escrows
- Releasing milestone payments
- Confirming deliveries
- Canceling and completing escrows
- Monitoring on-chain state

## Environment Variables

Add the following to your `.env` file:

```bash
# Stellar Configuration
STELLAR_NETWORK=testnet                    # testnet or mainnet
WALLET_SECRET="your-stellar-wallet-secret" # Secret key for signing transactions
STELLAR_TIMEOUT=60000                      # Request timeout in ms
STELLAR_MAX_RETRIES=3                      # Max retry attempts for failed requests
STELLAR_RETRY_DELAY=1000                   # Base delay between retries in ms
```

## Usage Examples

### Creating an On-Chain Escrow

```typescript
// In your controller/service
const txHash = await this.escrowStellarIntegrationService.createOnChainEscrow(escrowId);
```

### Funding an Escrow

```typescript
const txHash = await this.escrowStellarIntegrationService.fundOnChainEscrow(
  escrowId,
  funderPublicKey,
  amount,
  assetCode
);
```

### Releasing a Milestone Payment

```typescript
const txHash = await this.escrowStellarIntegrationService.releaseMilestonePayment(
  escrowId,
  milestoneId,
  releaserPublicKey,
  recipientPublicKey,
  amount,
  assetCode
);
```

## Error Handling

The service includes comprehensive error handling with:
- Stellar-specific error mapping
- Network failure retries
- Detailed logging
- Validation checks

## Security Considerations

- Private keys are handled securely via environment variables
- Transaction validation occurs before submission
- Rate limiting prevents abuse
- Proper access controls on escrow operations