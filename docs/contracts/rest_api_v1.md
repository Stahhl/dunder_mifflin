# REST API Contracts (Demo v1)

Base path: `/api/v1`

All timestamps are ISO-8601 UTC (`2026-02-18T20:00:00Z`).

## 1. Common Conventions

### Headers
- `X-Request-Id` (optional)
- `traceparent` (optional, recommended)
- `Idempotency-Key` (required for retryable mutation endpoints marked below)

### Standard Error Envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "quantity must be greater than 0",
    "details": [
      {
        "field": "items[0].quantity",
        "issue": "min:1"
      }
    ],
    "traceId": "b3f1f8a97f4a3d56"
  }
}
```

## 2. Auth and Nav

### `GET /auth/me`
Returns current authenticated user and app visibility rules.

```json
{
  "userId": "jhalpert",
  "displayName": "Jim Halpert",
  "roles": ["sales-associate"],
  "groups": ["sales"],
  "apps": ["portal", "infinity"],
  "sessionExpiresAt": "2026-02-18T21:00:00Z"
}
```

## 3. Leads (Sales)

### `GET /leads?stage=QUALIFIED&page=0&size=50`

```json
{
  "items": [
    {
      "leadId": "lead_1001",
      "companyName": "Blue Cross",
      "contactName": "Alyssa Jones",
      "stage": "QUALIFIED",
      "ownerUserId": "jhalpert",
      "expectedMonthlyReams": 50,
      "updatedAt": "2026-02-18T20:10:00Z"
    }
  ],
  "page": 0,
  "size": 50,
  "total": 1
}
```

### `POST /leads`

```json
{
  "companyName": "Lackawanna County",
  "contactName": "Janice Cole",
  "contactEmail": "janice.cole@example.com",
  "contactPhone": "+1-570-555-0118",
  "expectedMonthlyReams": 120,
  "notes": "Prefers recycled paper"
}
```

201 response:

```json
{
  "leadId": "lead_1002",
  "stage": "NEW"
}
```

### `PATCH /leads/{leadId}`
Allowed fields: `stage`, `notes`, `expectedMonthlyReams`, `ownerUserId`.

### `POST /leads/{leadId}/convert`
Converts lead into client and returns new client ID.

```json
{
  "clientId": "client_501",
  "convertedFromLeadId": "lead_1002",
  "convertedAt": "2026-02-18T20:22:00Z"
}
```

## 4. Orders (Sales)

### `POST /orders`

```json
{
  "clientId": "client_501",
  "requestedShipDate": "2026-02-20",
  "items": [
    {
      "sku": "PPR-A4-WHT-500",
      "quantity": 50
    }
  ],
  "notes": "Loading dock closes at 5 PM"
}
```

201 response:

```json
{
  "orderId": "ord_9001",
  "status": "CREATED",
  "createdAt": "2026-02-18T20:25:00Z"
}
```

### `GET /orders?clientId=client_501`
Returns order summaries.

### `GET /orders/{orderId}`
Returns full order detail including current status and shipment ID.

### `GET /orders/{orderId}/timeline`

```json
{
  "orderId": "ord_9001",
  "events": [
    {
      "status": "CREATED",
      "at": "2026-02-18T20:25:00Z",
      "source": "order-service"
    },
    {
      "status": "RESERVED",
      "at": "2026-02-18T20:25:04Z",
      "source": "inventory-service"
    },
    {
      "status": "SHIPPED",
      "at": "2026-02-18T20:45:11Z",
      "source": "inventory-service"
    }
  ]
}
```

## 5. Warehouse Shipments

### `GET /warehouse/shipments?status=PENDING`
Returns pending shipment work queue for warehouse app.

### `POST /warehouse/shipments/{shipmentId}/scan`
Records a barcode scan for a line item.

```json
{
  "barcode": "SKU:PPR-A4-WHT-500",
  "quantity": 10
}
```

### `POST /warehouse/shipments/{shipmentId}/dispatch`
Requires `Idempotency-Key` header.

```json
{
  "truckId": "truck_scr_03",
  "dispatchedAt": "2026-02-18T20:45:00Z"
}
```

## 6. Expenses (Accounting)

### `POST /expenses`

```json
{
  "submitterUserId": "mscott",
  "category": "OFFICE_SUPPLIES",
  "amount": 129.95,
  "currency": "USD",
  "description": "Core Blaster Extreme",
  "receiptUrl": "https://example.invalid/receipt/123"
}
```

### `GET /expenses?status=PENDING`
Expense queue for accounting.

### `POST /expenses/{expenseId}/decision`

```json
{
  "decision": "REJECTED",
  "comment": "Frivolous"
}
```

## 7. Notifications (WUPHF)

### `GET /notifications?unreadOnly=true`
Returns notification list for current user.

### `POST /notifications/{notificationId}/read`
Marks a notification as read.

## 8. Enums

### Lead Stage
- `NEW`
- `CONTACTED`
- `QUALIFIED`
- `PROPOSAL`
- `NEGOTIATION`
- `WON`
- `LOST`

### Order Status
- `CREATED`
- `RESERVED`
- `PICKING`
- `SHIPPED`
- `FAILED_INSUFFICIENT_STOCK`
- `CANCELLED`

### Shipment Status
- `PENDING`
- `LOADING`
- `DISPATCHED`
- `FAILED`

### Expense Status
- `PENDING`
- `APPROVED`
- `REJECTED`
