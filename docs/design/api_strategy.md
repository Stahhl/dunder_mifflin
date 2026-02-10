# API Strategy & Event Governance

## 1. Overview
This document defines how Dunder Mifflin services communicate, share schemas, and manage changes without breaking the warehouse scanners. We prioritize **Schema-First Design** and **Strict Backwards Compatibility**.

## 2. API Standards (Synchronous - REST)

*   **Specification:** OpenAPI 3.0 (Swagger).
*   **Workflow:** Code-First (Annotated Controllers) -> Generate Spec.
*   **Versioning:** URI Versioning (`/api/v1/orders`).
    *   **Rule:** Breaking changes require a new version (`v2`).
    *   **Deprecation:** Old versions must be supported for at least one fiscal quarter (or until Michael notices).

## 3. Event Standards (Asynchronous - Kafka)

We use **CloudEvents** (structured mode) over JSON to ensure metadata (source, type, time) is consistent.

### A. The "Shared Contracts" Library
To avoid "Schema Registry" complexity (which adds runtime dependencies), we will use a **Shared Kotlin Library** (`libs/dunder-contracts`) published to our local Maven repository.

*   **Content:**
    *   CloudEvent Types (Enums).
    *   Data Payloads (Kotlin Data Classes).
    *   JSON SerDes (Jackson Modules).
*   **Usage:**
    *   `sales-service` imports `dunder-contracts:1.0.0` to publish `OrderCreated`.
    *   `inventory-service` imports `dunder-contracts:1.0.0` to consume it.

### B. Event Versioning Strategy

We enforce **Forward-Only, Additive Changes** (The "No Take-Backs" Rule).

#### 1. The Payload Wrapper
All event payloads are wrapped in a versioned object structure to allow multi-version support in the same topic.

```json
{
  "specversion": "1.0",
  "type": "com.dundermifflin.sales.OrderCreated",
  "source": "/sales-service",
  "data": {
    "v1": {
      "orderId": "123",
      "amount": 100.00
    },
    "v2": {
      "orderId": "123",
      "totalAmount": 100.00,
      "currency": "USD"
    }
  }
}
```

*   **Pro:** Consumers can read `v1` or `v2` from the same message.
*   **Con:** Message size grows. (Acceptable for paper sales).

#### 2. Alternative: Topic Versioning
If a schema change is radically incompatible (structural break), we fork the topic.
*   Old: `sales.orders.v1`
*   New: `sales.orders.v2`
*   **Migration:** The producer Dual-Writes to both topics for a transition period.

### C. Governance Rules

1.  **Never delete a field.** Mark it `@Deprecated`.
2.  **Never rename a field.** Add a new field and deprecate the old one.
3.  **Always provide default values** for new fields (Consumer tolerance).

## 4. Shared Library Structure

```
dunder-contracts/
├── src/main/kotlin/
│   ├── events/
│   │   ├── sales/
│   │   │   ├── OrderCreatedV1.kt
│   │   │   └── OrderCreatedV2.kt
│   │   └── inventory/
│   └── common/
│       └── CloudEventWrapper.kt
└── build.gradle.kts
```

## 5. Testing Contracts

We use **Consumer-Driven Contracts (Spring Cloud Contract)** or standard integration tests.
*   **Producer Test:** Ensures the app generates JSON matching the `dunder-contracts` schema.
*   **Consumer Test:** Ensures the app can deserialize sample JSONs from the library.
