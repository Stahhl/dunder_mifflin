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

## Demo Environment Targets

- Docker Compose v2
- Java 21
- Node.js 20+
- pnpm

## Current State

- PR1 scaffold is in progress with a working Portal app at `apps/portal`.
- Planning/specification docs remain the source of truth for roadmap and contracts.

## Quickstart (Portal PR1)

```bash
pnpm install
pnpm dev:portal
```

## Quickstart (Infrastructure)

```bash
cp .env.example .env
docker compose --profile infra up -d

# includes frontend/backend build targets
docker compose --profile app up -d --build
```
