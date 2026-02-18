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

### A. The "Versioned Contracts" Repository
To preserve team boundaries, contracts must be shared as **versioned schemas/artifacts**, not as cross-service source code.

*   **Source of truth:**
    *   OpenAPI specs for REST contracts.
    *   AsyncAPI and JSON Schema for event contracts.
*   **Distribution:**
    *   Publish versioned artifacts from a dedicated contracts root/repo (for example `contracts/dunder-events`).
    *   Backend services and frontend apps consume published versions through code generation in their own build pipelines.
*   **Usage:**
    *   `sales-service` generates publisher DTOs/serializers from contract artifact version `1.0.0`.
    *   `inventory-service` generates consumer models from the same version.
    *   Frontend apps generate TypeScript clients/types from published OpenAPI versions.

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

## 4. Contracts Repository Structure

```
contracts/dunder-events/
├── openapi/
│   └── sales-api.v1.yaml
├── asyncapi/
│   └── order-events.v1.yaml
├── jsonschema/
│   ├── sales.order-created.v1.json
│   └── sales.order-created.v2.json
└── CHANGELOG.md
```

## 5. Testing Contracts

We use **Consumer-Driven Contracts (Spring Cloud Contract)** or standard integration tests.
*   **Producer Test:** Ensures the app generates JSON matching the published contract schema version.
*   **Consumer Test:** Ensures the app can deserialize sample payloads from the contract artifact fixtures.
