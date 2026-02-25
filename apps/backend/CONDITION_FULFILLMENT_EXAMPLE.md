# Condition Fulfillment API Example

This document demonstrates how to use the new condition fulfillment and confirmation endpoints.

## API Endpoints

### 1. Fulfill Condition (Seller)
```http
POST /escrows/{escrowId}/conditions/{conditionId}/fulfill
Authorization: Bearer {seller_token}
Content-Type: application/json

{
  "notes": "Package has been shipped via FedEx",
  "evidence": "Tracking number: 1234567890"
}
```

**Response:**
```json
{
  "id": "condition-123",
  "escrowId": "escrow-456",
  "description": "Delivery confirmation required",
  "type": "manual",
  "isFulfilled": true,
  "fulfilledAt": "2024-01-15T10:30:00Z",
  "fulfilledByUserId": "seller-user-id",
  "fulfillmentNotes": "Package has been shipped via FedEx",
  "fulfillmentEvidence": "Tracking number: 1234567890",
  "isMet": false,
  "metAt": null,
  "metByUserId": null
}
```

### 2. Confirm Condition (Buyer)
```http
POST /escrows/{escrowId}/conditions/{conditionId}/confirm
Authorization: Bearer {buyer_token}
```

**Response:**
```json
{
  "id": "condition-123",
  "escrowId": "escrow-456",
  "description": "Delivery confirmation required",
  "type": "manual",
  "isFulfilled": true,
  "fulfilledAt": "2024-01-15T10:30:00Z",
  "fulfilledByUserId": "seller-user-id",
  "fulfillmentNotes": "Package has been shipped via FedEx",
  "fulfillmentEvidence": "Tracking number: 1234567890",
  "isMet": true,
  "metAt": "2024-01-15T14:45:00Z",
  "metByUserId": "buyer-user-id"
}
```

## Workflow

1. **Seller fulfills condition**: Marks the condition as fulfilled with optional notes and evidence
2. **Buyer confirms condition**: Confirms that the condition has been met
3. **Auto-release**: If all conditions are confirmed, the escrow is automatically released

## Permission Rules

- Only **sellers** can fulfill conditions
- Only **buyers** can confirm conditions
- Escrow must be in **ACTIVE** status
- Conditions must be **fulfilled** before they can be **confirmed**

## Events and Webhooks

The system emits the following webhook events:
- `condition.fulfilled` - When a seller fulfills a condition
- `condition.confirmed` - When a buyer confirms a condition

## Error Handling

- `403 Forbidden`: User doesn't have permission (wrong role)
- `400 Bad Request`: Invalid state (escrow not active, condition not fulfilled)
- `404 Not Found`: Escrow or condition doesn't exist