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
| `sales-service` | PostgreSQL | `sales` | Leads, clients, and `outbox_events` / `inbox_events` tables. |
| `order-service` | PostgreSQL | `orders` | Orders, timeline projection, and `outbox_events` / `inbox_events`. |
| `inventory-service` | PostgreSQL | `inventory` | Stock, reservations, shipments, scan log, and `outbox_events` / `inbox_events`. |
| `finance-service` | PostgreSQL | `finance` | Expenses, decisions, and `outbox_events` / `inbox_events`. |
| `wuphf-service` | PostgreSQL | `notifications` | Notification inbox/read state and processed event IDs. |
| `keycloak` | PostgreSQL | `keycloak` | Keycloak realm/config/auth persistence. |
| `openldap` | LDAP data store | `dc=dundermifflin,dc=com` | Source of identities/groups. |
| `rabbitmq` | Queue storage | exchanges/queues | Event transport and retry/DLQ handling. |

## RabbitMQ Ownership

| Exchange | Producer Services | Primary Consumers |
|---|---|---|
| `dm.domain.events` | all domain services | service-specific queues |
| `dm.domain.events.dlx` | broker dead-letter flow | ops + requeue tooling |

Queue and routing-key contracts are defined in `docs/contracts/event_catalog_v1.md`.

## Data Access Rules

- Only owning service may write its schema.
- Direct cross-schema SQL between services is not allowed.
- Services maintain local read models required for UI/API responses.
- Gateway never reads or writes business tables directly.

## Non-Replay Broker Compensation

Because RabbitMQ is used as a delivery bus (not an event history store):

- Every publishing service persists outgoing events in `outbox_events` before publish.
- Every consuming service records processed CloudEvent IDs (`inbox_events` or equivalent) for deduplication.
- User-facing timelines and status views are persisted in service tables, not derived from broker history.
- Failed messages go to DLQ and are replayed operationally, not by ad hoc event-log rebuild.

## Backup and Retention (Demo Defaults)

- PostgreSQL: daily snapshot, 7-day retention.
- RabbitMQ queues: operational TTL/policy managed by environment (no long-term history guarantee).
- Notifications: retain read/unread records for 90 days.

## Contract References

- REST routing and endpoint contracts: `docs/contracts/rest_api_v1.md`
- Event envelopes and payload contracts: `docs/contracts/event_catalog_v1.md`
