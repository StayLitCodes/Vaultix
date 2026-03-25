# Authentication API Documentation

This document describes the wallet-based authentication system for Vaultix, which uses Stellar wallet signatures for passwordless authentication.

## Overview

The authentication system follows a challenge-response pattern:

1. **Challenge Generation**: Client requests a nonce for their wallet address
2. **Signature Verification**: Client signs the challenge message with their private key
3. **Token Issuance**: Server verifies signature and issues JWT tokens
4. **Session Management**: Client uses access token for API calls, refresh token for renewal

## Base URL

```
http://localhost:3000/auth
```

## Endpoints

### 1. Generate Challenge

**POST** `/auth/challenge`

Generates a unique nonce (challenge) for the given wallet address.

#### Request Body

```json
{
  "walletAddress": "GD5DJQDZYKGHIHYLF4IR5J6DZLZBW5QQHXK5RWSLTZ5FT5ZJPQK5LW5D"
}
```

#### Response

```json
{
  "nonce": "a1b2c3d4e5f6789012345678901234ab",
  "message": "Sign this message to authenticate with Vaultix: a1b2c3d4e5f6789012345678901234ab"
}
```

#### Status Codes

- `200 OK`: Challenge generated successfully
- `400 Bad Request`: Invalid wallet address format
- `429 Too Many Requests`: Rate limit exceeded

---

### 2. Verify Signature

**POST** `/auth/verify`

Verifies the wallet signature and returns authentication tokens.

#### Request Body

```json
{
  "walletAddress": "GD5DJQDZYKGHIHYLF4IR5J6DZLZBW5QQHXK5RWSLTZ5FT5ZJPQK5LW5D",
  "signature": "4a1b2c3d4e5f6789012345678901234ab...",
  "publicKey": "GD5DJQDZYKGHIHYLF4IR5J6DZLZBW5QQHXK5RWSLTZ5FT5ZJPQK5LW5D"
}
```

#### Response

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "a1b2c3d4e5f6789012345678901234ab..."
}
```

#### Status Codes

- `200 OK`: Authentication successful
- `401 Unauthorized`: Invalid signature or challenge
- `400 Bad Request`: Missing required fields

---

### 3. Refresh Access Token

**POST** `/auth/refresh`

Exchanges a refresh token for a new access token.

#### Request Body

```json
{
  "refreshToken": "a1b2c3d4e5f6789012345678901234ab..."
}
```

#### Response

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "b2c3d4e5f6789012345678901234abcd..."
}
```

#### Status Codes

- `200 OK`: Token refreshed successfully
- `401 Unauthorized`: Invalid or expired refresh token

---

### 4. Get Current User

**GET** `/auth/me`

Returns information about the currently authenticated user.

#### Headers

```
Authorization: Bearer <access_token>
```

#### Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "walletAddress": "GD5DJQDZYKGHIHYLF4IR5J6DZLZBW5QQHXK5RWSLTZ5FT5ZJPQK5LW5D",
  "isActive": true,
  "createdAt": "2024-01-22T10:30:00.000Z"
}
```

#### Status Codes

- `200 OK`: User information retrieved
- `401 Unauthorized`: Invalid or missing access token

---

### 5. Logout

**POST** `/auth/logout`

Invalidates the refresh token and logs out the user.

#### Headers

```
Authorization: Bearer <access_token>
```

#### Request Body

```json
{
  "refreshToken": "a1b2c3d4e5f6789012345678901234ab..."
}
```

#### Response

```json
{
  "message": "Successfully logged out"
}
```

#### Status Codes

- `200 OK`: Logout successful
- `401 Unauthorized`: Invalid access token

## Security Considerations

### Rate Limiting

All authentication endpoints are rate-limited to prevent abuse:
- **10 requests per minute** per IP address
- Exceeding limits results in `429 Too Many Requests` responses

### Token Security

#### Access Tokens
- **Expiration**: 15 minutes
- **Usage**: API authentication
- **Format**: JWT with user ID and wallet address

#### Refresh Tokens
- **Expiration**: 7 days
- **Usage**: Token renewal
- **Storage**: Server-side with user association
- **Invalidation**: Automatic on logout or reuse

### Signature Verification

The system uses Stellar SDK for cryptographic verification:
- Messages are signed using the wallet's private key
- Signatures are verified against the provided public key
- Public key must match the wallet address

### Best Practices

1. **Token Storage**: Store tokens securely on the client side
2. **HTTPS**: Always use HTTPS in production
3. **Token Rotation**: Use refresh tokens to maintain sessions
4. **Error Handling**: Implement proper error handling for authentication failures
5. **Nonce Usage**: Each nonce is single-use and expires after verification

## Error Responses

All endpoints may return these common error responses:

### 400 Bad Request
```json
{
  "message": "Validation failed",
  "error": "Bad Request"
}
```

### 401 Unauthorized
```json
{
  "message": "Invalid or expired token",
  "error": "Unauthorized"
}
```

### 429 Too Many Requests
```json
{
  "message": "Too many requests",
  "error": "Too Many Requests"
}
```

## Integration Example

### JavaScript/TypeScript Client

```typescript
import * as StellarSdk from 'stellar-sdk';

class VaultixAuth {
  private baseURL = 'http://localhost:3000/auth';

  async authenticate(walletKeypair: StellarSdk.Keypair) {
    // 1. Get challenge
    const challengeResponse = await fetch(`${this.baseURL}/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: walletKeypair.publicKey()
      })
    });
    const { message } = await challengeResponse.json();

    // 2. Sign message
    const signature = walletKeypair.sign(message).toString('hex');

    // 3. Verify and get tokens
    const verifyResponse = await fetch(`${this.baseURL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: walletKeypair.publicKey(),
        signature,
        publicKey: walletKeypair.publicKey()
      })
    });
    
    return await verifyResponse.json();
  }

  async getCurrentUser(accessToken: string) {
    const response = await fetch(`${this.baseURL}/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    return await response.json();
  }
}
```

## Testing

The authentication system includes comprehensive e2e tests covering:
- Challenge generation and uniqueness
- Signature verification
- Token issuance and validation
- Refresh token functionality
- Rate limiting behavior
- Error scenarios

Run tests with:
```bash
npm run test:e2e
```
