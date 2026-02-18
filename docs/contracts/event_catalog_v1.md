# Event Catalog (Demo v1)

Format: CloudEvents 1.0 JSON over Kafka.

## 1. Envelope

```json
{
  "specversion": "1.0",
  "id": "evt_01JX8N75E72J2H6W5S4VQ8F8ZM",
  "type": "com.dundermifflin.order.created.v1",
  "source": "/order-service",
  "subject": "order/ord_9001",
  "time": "2026-02-18T20:25:00Z",
  "datacontenttype": "application/json",
  "data": {}
}
```

## 2. Topics

| Topic | Producer | Primary Consumers |
|---|---|---|
| `dm.sales.leads` | `sales-service` | `order-service`, `wuphf-service` |
| `dm.orders.lifecycle` | `order-service` | `inventory-service`, `wuphf-service` |
| `dm.inventory.shipments` | `inventory-service` | `order-service`, `wuphf-service` |
| `dm.finance.expenses` | `finance-service` | `wuphf-service` |
| `dm.notifications` | `wuphf-service` | notification read model |

Partition key: domain aggregate ID (`leadId`, `orderId`, `shipmentId`, `expenseId`).

## 3. Event Types

### Sales

#### `com.dundermifflin.sales.lead.converted.v1`
Topic: `dm.sales.leads`

```json
{
  "leadId": "lead_1002",
  "clientId": "client_501",
  "convertedBy": "jhalpert",
  "convertedAt": "2026-02-18T20:22:00Z"
}
```

### Orders

#### `com.dundermifflin.order.created.v1`
Topic: `dm.orders.lifecycle`

```json
{
  "orderId": "ord_9001",
  "clientId": "client_501",
  "items": [
    { "sku": "PPR-A4-WHT-500", "quantity": 50 }
  ],
  "createdBy": "jhalpert",
  "createdAt": "2026-02-18T20:25:00Z"
}
```

#### `com.dundermifflin.order.status.changed.v1`
Topic: `dm.orders.lifecycle`

```json
{
  "orderId": "ord_9001",
  "status": "RESERVED",
  "reason": null,
  "at": "2026-02-18T20:25:04Z"
}
```

Allowed status values mirror REST `Order Status` enum.

### Inventory and Shipment

#### `com.dundermifflin.inventory.stock.reserved.v1`
Topic: `dm.inventory.shipments`

```json
{
  "orderId": "ord_9001",
  "reservationId": "res_122",
  "status": "RESERVED",
  "at": "2026-02-18T20:25:04Z"
}
```

#### `com.dundermifflin.inventory.stock.failed.v1`
Topic: `dm.inventory.shipments`

```json
{
  "orderId": "ord_9001",
  "status": "FAILED_INSUFFICIENT_STOCK",
  "missingItems": [
    { "sku": "PPR-A4-WHT-500", "missingQuantity": 10 }
  ],
  "at": "2026-02-18T20:25:04Z"
}
```

#### `com.dundermifflin.shipment.dispatched.v1`
Topic: `dm.inventory.shipments`

```json
{
  "shipmentId": "ship_444",
  "orderId": "ord_9001",
  "dispatchedBy": "dphilbin",
  "truckId": "truck_scr_03",
  "dispatchedAt": "2026-02-18T20:45:11Z"
}
```

### Finance

#### `com.dundermifflin.expense.submitted.v1`
Topic: `dm.finance.expenses`

```json
{
  "expenseId": "exp_500",
  "submitterUserId": "mscott",
  "amount": 129.95,
  "currency": "USD",
  "submittedAt": "2026-02-18T20:30:00Z"
}
```

#### `com.dundermifflin.expense.decided.v1`
Topic: `dm.finance.expenses`

```json
{
  "expenseId": "exp_500",
  "decision": "REJECTED",
  "decidedBy": "amartin",
  "comment": "Frivolous",
  "decidedAt": "2026-02-18T20:36:00Z"
}
```

### Notifications

#### `com.dundermifflin.notification.created.v1`
Topic: `dm.notifications`

```json
{
  "notificationId": "ntf_900",
  "userId": "jhalpert",
  "kind": "SHIPMENT_DISPATCHED",
  "title": "Order ord_9001 shipped",
  "body": "Shipment ship_444 has left the warehouse",
  "deepLink": "/infinity/orders/ord_9001",
  "createdAt": "2026-02-18T20:45:12Z"
}
```

## 4. Versioning Rules

- Additive changes only within `v1`.
- Breaking change requires `v2` event type.
- Producers may dual-publish `v1` and `v2` during transition.
