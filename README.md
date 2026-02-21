# Dunder Mifflin Demo Platform

This repository contains the implementation plan and delivery docs for a demo ERP platform themed around Dunder Mifflin Scranton.

## Documentation Index

### Roadmap
- [Product Delivery TODO (PR-by-PR)](./docs/roadmap/pr_delivery_todo.md)

### Architecture
- [System Overview](./docs/architecture/system_overview.md)
- [Datastore Overview](./docs/architecture/datastore_overview.md)
- [Identity & Access](./docs/architecture/identity_access.md)
- [Frontend Overview](./docs/architecture/frontend_overview.md)
- [Observability Strategy](./docs/architecture/observability_strategy.md)

### Guidelines
- [API and Event Governance](./docs/guidelines/api_and_events.md)
- [Backend Standards](./docs/guidelines/backend_standards.md)
- [Frontend Standards](./docs/guidelines/frontend_standards.md)
- [Infrastructure and Deployment](./docs/guidelines/infrastructure_deployment.md)
- [Testing Strategy](./docs/guidelines/testing_strategy.md)

### Reference
- [Users and Groups](./docs/reference/users_and_groups.md)

### Operations
- [PR9 Reliability Signals Contract](./docs/operations/pr9_reliability_signals.md)

### Contracts (Demo v1)
- [REST API Contracts](./docs/contracts/rest_api_v1.md)
- [Event Catalog](./docs/contracts/event_catalog_v1.md)

## Planned Repository Shape

```text
.
├── apps/                 # Frontend apps (portal, infinity, accounting, warehouse-mobile)
├── services/             # Backend services (gateway, sales, order, inventory, finance, profile, wuphf)
├── libs/                 # Shared contracts and SDKs
├── docs/                 # Architecture, standards, roadmap, contracts
├── platform/             # Seed data and third-party service configs
├── docker-compose.yml    # Main stack (infra + app services)
└── .env.example          # Compose environment defaults
```

## Host Dependencies

- Docker with Docker Compose v2

## Current State

- PR1-PR8 are implemented locally, including auth/navigation, sales order flow + timeline, warehouse mobile, accounting approvals, WUPHF notifications, and warehouse offline replay.
- Frontends in active use: `apps/portal`, `apps/infinity`, `apps/accounting`, `apps/warehouse-mobile`, and `apps/wuphf-widget` (embedded).
- Backends in active use: `services/gateway`, `services/order-service`, `services/inventory-service`, `services/finance-service`, and `services/wuphf-service`.
- Warehouse shipment API ownership is now in `services/inventory-service`, with `services/order-service` consuming `shipment.dispatched.v1` to keep order status/timeline in sync.
- Playwright smoke coverage currently includes PR2-PR8 specs.
- Roadmap/contracts docs remain the source of truth for remaining scope (PR9+).

## Quickstart (Docker-Only)

```bash
cp .env.example .env
docker compose --profile infra up -d

# includes frontend/backend build targets
docker compose --profile app up -d --build

# run all workspace unit tests in Docker
docker compose --profile test run --rm unit-tests

# run order-service integration tests (postgres + rabbitmq adapters)
docker compose --profile test run --rm order-service-integration-tests

# run Playwright smoke suite (current PR2-PR8 coverage)
docker compose --profile test run --rm e2e-tests
```
