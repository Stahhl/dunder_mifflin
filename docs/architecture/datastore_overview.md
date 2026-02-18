# Dunder Mifflin Demo - Datastore Overview

This document defines datastore ownership for each service and the shared infrastructure boundaries.

## Storage Principles

- Each service owns its write model and schema.
- Cross-service integration uses REST and Kafka events, not direct table access.
- Read models can be denormalized per service as needed.
- For demo simplicity, services share one PostgreSQL instance with separate schemas.

## Service Datastore Matrix

| Service | Primary Datastore | Owned Schema / Namespace | Notes |
|---|---|---|---|
| `gateway` | In-memory session store | n/a | Web session state is server-side in-memory for demo runs. |
| `profile-service` | PostgreSQL | `profile` | User preferences, avatars, app settings. |
| `sales-service` | PostgreSQL | `sales` | Leads and clients. |
| `order-service` | PostgreSQL | `orders` | Orders and order timeline read model. |
| `inventory-service` | PostgreSQL | `inventory` | Stock, reservations, shipments. |
| `finance-service` | PostgreSQL | `finance` | Expenses and approval decisions. |
| `wuphf-service` | PostgreSQL | `notifications` | Notification inbox/read state projection. |
| `keycloak` | PostgreSQL | `keycloak` | Keycloak realm/config/auth persistence. |
| `openldap` | LDAP data store | `dc=dundermifflin,dc=com` | Source of identities/groups. |
| `kafka` | Kafka log storage | topic namespaces | Event transport and replay. |

## Kafka Topic Ownership

| Topic | Producer | Primary Persistence Side Effect |
|---|---|---|
| `dm.sales.leads` | `sales-service` | Lead conversion downstream actions |
| `dm.orders.lifecycle` | `order-service` | Inventory reservation + timeline updates |
| `dm.inventory.shipments` | `inventory-service` | Order status updates + notifications |
| `dm.finance.expenses` | `finance-service` | Expense decision notifications |
| `dm.notifications` | `wuphf-service` | Notification read model fan-out |

## Data Access Rules

- Only owning service may write its schema.
- Direct cross-schema SQL between services is not allowed.
- Services may keep local projections for performance/reliability.
- Gateway never reads or writes business tables directly.

## Backup and Retention (Demo Defaults)

- PostgreSQL: daily snapshot, 7-day retention.
- Kafka: 7-day retention for lifecycle topics.
- Notifications: retain read/unread records for 90 days.

## Contract References

- REST routing and endpoint contracts: `docs/contracts/rest_api_v1.md`
- Event envelopes and payload contracts: `docs/contracts/event_catalog_v1.md`
