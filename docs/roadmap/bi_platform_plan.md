# Business Intelligence Platform Plan (Future Backlog)

This document defines a decoupled BI plan so analytics teams can query high-volume operational data without direct access to service-owned databases.

## 1. Goal

- Provide scalable analytics access for large data sets (for example tens of thousands of orders).
- Keep service databases private to each domain team.
- Preserve backend autonomy for schema/provider changes.

## 2. Architecture Direction

Use an event-driven analytics pipeline as the system-of-integration boundary.

1. Domain services continue publishing versioned events to RabbitMQ.
2. A new BI ingestion service consumes events and writes both an immutable raw event store (lake) and analytics-optimized warehouse tables.
3. BI tooling queries warehouse/lake through read-only credentials.

No BI team access to app service databases.

## 3. Recommended MVP Stack (Docker-Friendly)

- Ingestion service: new `services/bi-ingestion-service` (Kotlin/Spring preferred for platform consistency).
- Message source: existing RabbitMQ exchange (`dm.domain.events` and relevant routing keys).
- Raw store (lake): MinIO + Parquet partitions (`event_date`, `event_type`).
- Warehouse: ClickHouse for fast analytical queries.
- BI UI: Metabase connected to ClickHouse with read-only role.

This stack is practical to run locally with Docker Compose and can be incrementally hardened later.

## 4. Data Model and Contracts

Every analytics event should include:

- `event_id` (globally unique, immutable, dedupe key).
- `event_type` (versioned event name).
- `occurred_at` (UTC timestamp from producer).
- `producer_service`.
- `schema_version`.
- `payload` (domain data).

For warehouse tables:

- `fact_orders`, `fact_shipments`, `fact_expenses`, `fact_notifications`.
- dimensional tables where needed (`dim_client`, `dim_user_role`, `dim_product`, `dim_time`).
- model updates are append-first; avoid destructive rewrites in MVP.

## 5. Reliability and Replay

- At-least-once consumption is expected.
- Enforce idempotent ingest by unique key on `event_id`.
- Keep dead-letter queue for poison messages and parse failures.
- Support replay by re-consuming from a selected offset/window.

## 6. Security and Governance

- BI users receive read-only access to BI tools/warehouse only.
- Service DB credentials remain inaccessible outside owning service teams.
- PII classification and masking rules enforced in ingestion/transforms.
- Separate operational role (`it-support`) from BI analyst roles.
- Track lineage: event source, ingestion time, transform version.

## 7. Rollout Plan

### Phase A: Foundation (Current Active Step)

- Add compose profile `bi` with MinIO, ClickHouse, Metabase.
- Scaffold `bi-ingestion-service` and consume high-value events (`com.dundermifflin.order.created.v1`, `com.dundermifflin.shipment.dispatched.v1`, `com.dundermifflin.expense.decided.v1`).
- Write raw + curated order/shipment/expense tables.

### Phase B: BI Usability

- Publish baseline dashboards (orders throughput, shipment SLA, expense decision latency).
- Add analyst read-only users and sample SQL/model documentation.
- Add basic data quality checks (null/duplicate/freshness).

### Phase C: Governance and Scale

- Add schema registry/process for event schema evolution.
- Add retention and partition management policies.
- Add backfill/replay runbooks and incident response workflow.

## 8. Acceptance Criteria for Initial Delivery

- BI stack starts in Docker with one command (`docker compose --profile bi up -d`).
- `bi-ingestion-service` ingests and persists events idempotently.
- Analysts can query curated tables in Metabase without service DB access.
- Replay of a known event window does not create duplicate facts.
- Data access is auditable and role-scoped.
- BI automated test suite runs in CI and fails the merge gate on regression.

## 9. Non-Goals (Initial Delivery)

- Real-time sub-second streaming analytics.
- Cross-company enterprise MDM.
- Replacing existing transactional APIs.

## 10. Test Strategy (Required)

### 10.1 Ingestion Replay and Idempotency Integration Tests

- Scope: `services/bi-ingestion-service`.
- Method: publish a deterministic event batch to RabbitMQ, replay the same batch, and assert no duplicate rows in curated warehouse tables.
- Required assertions: unique `event_id` enforcement in raw and curated layers, replay window reprocessing safety, and dead-letter behavior for malformed events.

### 10.2 Docker End-to-End BI Scenario

- Scope: compose profile `bi` with RabbitMQ + ingestion + MinIO + ClickHouse + Metabase.
- Method: publish sample domain events (`order.created`, `shipment.dispatched`, `expense.decided`), wait for ingestion completion, query ClickHouse facts for expected counts/aggregates, and verify Metabase is reachable while BI users remain read-only on the warehouse.
- Required assertions: curated facts match published event set, replay does not inflate counts, and BI users cannot mutate warehouse data.

### 10.3 CI Gate Contract

- Add dedicated BI gate workflow (for example `.github/workflows/bi-quality-gate.yml`).
- Gate commands should include ingestion integration tests, Docker E2E BI scenario tests, and data quality checks (freshness/duplicate/null thresholds).
- Merge policy: any BI test failure blocks merge to `main`.

## 11. Proposed Test Commands (Planning Baseline)

These command names are planning targets to standardize CI and local execution:

- `pnpm test:bi:integration`
- `pnpm test:bi:e2e`
- `pnpm test:bi:gate`
