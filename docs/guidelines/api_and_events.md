# API and Event Governance

## 1. Source of Truth

- REST source of truth: `docs/contracts/rest_api_v1.md`
- Event source of truth: `docs/contracts/event_catalog_v1.md`
- Any implementation must match these contracts exactly.

## 2. REST Standards

- Style: JSON over HTTP, resource-oriented routes.
- Base path: `/api/v1`.
- Breaking changes require `/api/v2`.
- Error envelope is standardized across services.
- Pagination uses `page`, `size`, `sort` query params.

## 3. Event Standards

- Format: CloudEvents 1.0 over Kafka.
- Event type naming: `com.dundermifflin.<domain>.<action>.v<version>`.
- Partition key: aggregate ID (`leadId`, `orderId`, `expenseId`, etc.).
- Event payloads are additive-only for non-breaking evolution.

## 4. Compatibility Rules

1. Never remove or rename fields in an existing version.
2. New required behavior must be introduced as a new version.
3. Producers may dual-publish during migrations.
4. Consumers must ignore unknown fields.

## 5. Idempotency Rules

- Mutating HTTP endpoints that may be retried must support `Idempotency-Key`.
- Warehouse offline replay must rely on idempotency keys.
- Event consumers must deduplicate by event ID.

## 6. Contract Testing Expectations

- Producer tests verify payloads against contract examples.
- Consumer tests verify compatibility with current version and prior non-deprecated version.
- Contract updates must be reviewed in the same PR as implementation updates.
