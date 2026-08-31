# KYC/AML Integration Documentation

## Overview

Vaultix implements a pluggable KYC (Know Your Customer) and AML (Anti-Money Laundering) system to meet compliance requirements for financial platforms. The system supports multiple identity verification providers and sanctions screening services via a provider pattern.

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                      Client App                          │
└───────────┬──────────────────────────┬──────────────────┘
            │                          │
            ▼                          ▼
┌───────────────────────┐   ┌──────────────────────────┐
│   KycController       │   │   KycWebhookController   │
│  GET  /kyc/status     │   │  POST /kyc/webhook/:prov  │
│  POST /kyc/initiate   │   │                          │
└───────────┬───────────┘   └───────────┬──────────────┘
            │                           │
            ▼                           ▼
┌──────────────────────────────────────────────────────────┐
│                     KycService                           │
│  - initiateVerification()                                │
│  - getKycStatus()                                       │
│  - processWebhook()                                     │
│  - adminUpdateKycStatus()                               │
│  - isKycVerified()                                      │
└───────────┬──────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────┐
│                  IKycProvider (Interface)                 │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────┐ │
│  │ MockProvider  │  │   Persona     │  │   Sumsub     │ │
│  │  (dev/test)   │  │ (production)  │  │ (production) │ │
│  └───────────────┘  └───────────────┘  └──────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Database Schema

#### User Entity (extended)
| Field | Type | Description |
|-------|------|-------------|
| kycStatus | varchar | `not_started`, `pending`, `verified`, `rejected`, `expired` |
| kycRejectionReason | varchar | Reason for rejection (nullable) |
| kycVerifiedAt | datetime | When the user was verified (nullable) |

#### KycVerification Entity
| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| userId | uuid | FK to users |
| provider | varchar | `mock`, `persona`, `sumsub`, `onfido` |
| providerVerificationId | varchar | ID from the provider |
| status | varchar | Current verification status |
| rejectionReason | varchar | Rejection reason (nullable) |
| providerMetadata | json | Provider-specific data |
| initiatedAt | datetime | When verification started |
| completedAt | datetime | When verification completed |
| expiresAt | datetime | Session expiration |

## API Endpoints

### User Endpoints

#### `GET /v1/kyc/status`
Get current KYC verification status for the authenticated user.

**Auth:** Bearer token required

**Response:**
```json
{
  "status": "verified",
  "provider": "mock",
  "initiatedAt": "2026-07-26T10:00:00Z",
  "completedAt": "2026-07-26T10:05:00Z"
}
```

#### `POST /v1/kyc/initiate`
Start a new KYC verification flow.

**Auth:** Bearer token required

**Request Body:**
```json
{
  "provider": "mock",
  "redirectPath": "/dashboard"
}
```

**Response:**
```json
{
  "verificationId": "mock-kyc-1234567890",
  "redirectUrl": "https://vaultix.io/v1/kyc/mock-verify?id=mock-kyc-1234567890",
  "expiresAt": "2026-07-27T10:00:00Z"
}
```

### Webhook Endpoints

#### `POST /v1/kyc/webhook/:provider`
Receive KYC provider callbacks. **No JWT auth required** — validates provider-specific signatures.

**Headers:**
- `X-KYC-Signature`: Provider's webhook signature (for validation)

**Path Parameters:**
- `provider`: `persona`, `sumsub`, `onfido`, or `mock`

### Admin Endpoints

#### `GET /v1/admin/kyc/users`
List all users with their KYC status (paginated, filterable).

**Auth:** Admin role required

**Query Parameters:**
- `status` (optional): Filter by KYC status
- `page` (default: 1)
- `limit` (default: 20)

#### `PATCH /v1/admin/kyc/users/:id/status`
Manually update a user's KYC status.

**Auth:** Admin role required

**Request Body:**
```json
{
  "status": "verified",
  "reason": "Manual verification after document review"
}
```

## High-Value Escrow Gating

Escrows above the KYC threshold (`KYC_REQUIRED_MIN_ESCROW_AMOUNT`, default: 1000 XLM) require KYC verification. The `KycGuard` is applied to the escrow creation endpoint.

Users attempting to create a high-value escrow without verified KYC will receive:
```json
{
  "statusCode": 403,
  "message": "KYC verification is required for this action. Please complete identity verification before proceeding."
}
```

## Provider Configuration

### Environment Variables

```bash
# Default KYC provider (mock, persona, sumsub, onfido)
KYC_DEFAULT_PROVIDER=mock

# Minimum escrow amount (in XLM) requiring KYC
KYC_REQUIRED_MIN_ESCROW_AMOUNT=1000

# Persona (production)
PERSONA_API_KEY=your-persona-api-key
PERSONA_TEMPLATE_ID=your-template-id

# Sumsub (production)
SUMSUB_API_KEY=your-sumsub-app-token
SUMSUB_SECRET_KEY=your-sumsub-secret-key

# AML Provider (mock, chainalysis)
AML_PROVIDER=mock

# Chainalysis (production)
CHAINALYSIS_API_KEY=your-chainalysis-api-key
```

### Adding a New KYC Provider

1. **Implement the `IKycProvider` interface:**

```typescript
import { IKycProvider, KycInitiateResult, KycWebhookResult } from '../interfaces/kyc-provider.interface';
import { KycStatus } from '../entities/kyc-verification.entity';

@Injectable()
export class PersonaKycProvider implements IKycProvider {
  readonly name = 'persona';

  async initiateVerification(userId: string, redirectPath?: string): Promise<KycInitiateResult> {
    // Call Persona API to create inquiry
    // Return verificationId and redirectUrl
  }

  async getVerificationStatus(verificationId: string): Promise<{ status: KycStatus; }> {
    // Call Persona API to get inquiry status
  }

  validateWebhook(payload: unknown, signature: string): boolean {
    // Validate HMAC signature from Persona
  }

  async processWebhook(payload: any): Promise<KycWebhookResult> {
    // Transform Persona webhook payload to standardized format
  }
}
```

2. **Register the provider in `KycService`:**

```typescript
// In kyc.service.ts constructor:
this.providers.set('persona', personaKycProvider);
```

3. **Update environment variables** with the provider's API credentials.

## AML Screening

### AML Flow

1. When an escrow is created with parties, their wallet addresses are screened
2. If any address is flagged (sanctioned, darknet, scam), the transaction can be blocked
3. Screening results are cached for 5 minutes to avoid redundant API calls

### AML Provider Interface

```typescript
interface IAmlProvider {
  readonly name: string;
  screenAddress(walletAddress: string): Promise<AmlScreeningResult>;
  screenAddresses?(walletAddresses: string[]): Promise<Record<string, AmlScreeningResult>>;
}

interface AmlScreeningResult {
  flagged: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  sanctionsLists?: string[];
  reason?: string;
}
```

### Testing KYC Webhooks (Mock Provider)

For local development, the mock provider accepts webhook calls directly. Send a POST to simulate verification:

```bash
curl -X POST http://localhost:3000/v1/kyc/webhook/mock \
  -H "Content-Type: application/json" \
  -H "X-KYC-Signature: any-signature" \
  -d '{
    "verificationId": "mock-kyc-1234567890",
    "status": "verified"
  }'
```

## Status Transitions

```
not_started ──► pending ──► verified
                    │
                    └──────► rejected
                    │
                    └──────► expired
```

Users can re-initiate verification after rejection or expiry.

## Audit Trail

All admin KYC status changes are tracked via the `admin_audit_log` table with:
- `actorId`: Admin who made the change
- `actionType`: `UPDATE_KYC_STATUS`
- `resourceType`: `USER`
- `resourceId`: User ID
- `metadata`: Old status, new status, reason
