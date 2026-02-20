# Infrastructure and Deployment Standards

## 1. Goal

Run the demo platform with a single command using Docker Compose.

## 2. Host Dependency

- Docker with Docker Compose v2 plugin.

## 3. Compose Layout

- `docker-compose.yml`: primary stack definition.
- `docker-compose.override.yml`: local development overrides.
- `.env.example`: documented environment variables.
- `platform/keycloak/realm-export.json`: seeded realm config.
- `platform/ldap/users.ldif`: seeded users/groups.

## 4. Runtime Profiles

- `app`: full stack (frontend + backend + infra + observability).
- `infra`: databases, broker, IAM only.
- `observability`: otel, prometheus, loki, grafana, jaeger.
- `e2e`: app profile plus test seed utilities.
- `test`: unit test runner containers.

## 5. Service Inventory

### Infrastructure
- `postgres`
- `rabbitmq`
- `keycloak`
- `openldap`
- `mailhog`

### Platform Services
- `gateway`
- `profile-service`
- `sales-service`
- `order-service`
- `inventory-service`
- `finance-service`
- `wuphf-service`

### Frontends
- `portal-web`
- `infinity-web`
- `accounting-web`
- `wuphf-widget`
- `warehouse-mobile` (Expo/dev profile or device build)

### Observability
- `otel-collector`
- `prometheus`
- `loki`
- `grafana`
- `jaeger`

## 6. Environment Defaults

Required variables (example values):
- `POSTGRES_USER=dundermifflin`
- `POSTGRES_PASSWORD=bears_beets_battlestar`
- `RABBITMQ_DEFAULT_USER=dunder`
- `RABBITMQ_DEFAULT_PASS=mifflin`
- `KEYCLOAK_ADMIN=admin`
- `KEYCLOAK_ADMIN_PASSWORD=admin`
- `KEYCLOAK_REALM=scranton-branch`

## 7. Data Store Topology

- One PostgreSQL container with separate schemas per service (`sales`, `orders`, `inventory`, `finance`, `profile`, `notifications`, `keycloak`).
- One RabbitMQ broker for all platform exchanges/queues listed in `docs/contracts/event_catalog_v1.md`.
- LDAP remains the source of truth for identity groups and user records.
- Service-to-service database access is disallowed outside owned schema.

## 8. Startup and Health Rules

- All services must define `healthcheck`.
- `depends_on` must use `condition: service_healthy` where supported.
- Gateway starts after IAM and required backend services are healthy.
- Frontends start after gateway is healthy.

## 9. Required Commands

```bash
# full demo stack
docker compose --profile app up -d

# infra only
docker compose --profile infra up -d

# unit tests
docker compose --profile test run --rm unit-tests

# PR2 Playwright auth/navigation test
# requires app profile services to be up
docker compose --profile test run --rm e2e-tests
```
