# Dunder Mifflin Demo - Datastore Overview

This document defines datastore ownership for each service and the shared infrastructure boundaries.

## Storage Principles

- Each service owns its write model and schema.
- Cross-service integration uses REST and RabbitMQ events, not direct table access.
- Read models are persisted in service databases (not reconstructed from broker replay).
- For demo simplicity, services share one PostgreSQL instance with separate schemas.

## Service Datastore Matrix

| Service | Primary Datastore | Owned Schema / Namespace | Notes |
|---|---|---|---|
| `gateway` | In-memory session store | n/a | Web session state is server-side in-memory for demo runs. |
| `profile-service` | PostgreSQL | `profile` | User preferences, avatars, app settings. |
| `sales-service` | PostgreSQL | `sales` | Leads and clients. |
| `order-service` | PostgreSQL | `orders` | Orders and timeline projection. |
| `inventory-service` | PostgreSQL | `inventory` | Stock, reservations, shipments, and scan log. |
| `finance-service` | PostgreSQL | `finance` | Expenses and approval decisions. |
| `wuphf-service` | PostgreSQL | `notifications` | Notification inbox/read state. |
| `keycloak` | PostgreSQL | `keycloak` | Keycloak realm/config/auth persistence. |
| `openldap` | LDAP data store | `dc=dundermifflin,dc=com` | Source of identities/groups. |
| `rabbitmq` | Queue storage | exchanges/queues | Event transport (always-on demo assumption). |

## RabbitMQ Ownership

| Exchange | Producer Services | Primary Consumers |
|---|---|---|
| `dm.domain.events` | all domain services | service-specific queues |

Queue and routing-key contracts are defined in `docs/contracts/event_catalog_v1.md`.

## Data Access Rules

- Only owning service may write its schema.
- Direct cross-schema SQL between services is not allowed.
- Services maintain local read models required for UI/API responses.
- Gateway never reads or writes business tables directly.

## Demo Broker Assumption

For this demo, RabbitMQ is assumed to be running and reachable while services are operating.

- Outbox/inbox reliability patterns are intentionally omitted.
- User-facing timelines and status views are persisted in service tables.
- If broker delivery fails, operations can be retried manually during development.

## Backup and Retention (Demo Defaults)

- PostgreSQL: daily snapshot, 7-day retention.
- RabbitMQ queues: operational TTL/policy managed by environment (no long-term history guarantee).
- Notifications: retain read/unread records for 90 days.

## Contract References

- REST routing and endpoint contracts: `docs/contracts/rest_api_v1.md`
- Event envelopes and payload contracts: `docs/contracts/event_catalog_v1.md`
