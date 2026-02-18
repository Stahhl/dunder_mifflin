# Infrastructure and Deployment Standards

## 1. Goal

Run the demo platform with a single command using Docker Compose.

## 2. Compose Layout

- `platform/docker-compose.yml`: primary stack definition.
- `platform/docker-compose.override.yml`: local development overrides.
- `platform/.env.example`: documented environment variables.
- `platform/keycloak/realm-export.json`: seeded realm config.
- `platform/ldap/users.ldif`: seeded users/groups.

## 3. Runtime Profiles

- `app`: full stack (frontend + backend + infra + observability).
- `infra`: databases, broker, IAM only.
- `observability`: otel, prometheus, loki, grafana, jaeger.
- `e2e`: app profile plus test seed utilities.

## 4. Service Inventory

### Infrastructure
- `postgres`
- `kafka`
- `zookeeper`
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
- `warehouse-mobile` (Expo/dev profile or device build)

### Observability
- `otel-collector`
- `prometheus`
- `loki`
- `grafana`
- `jaeger`

## 5. Environment Defaults

Required variables (example values):
- `POSTGRES_USER=dundermifflin`
- `POSTGRES_PASSWORD=bears_beets_battlestar`
- `KEYCLOAK_ADMIN=admin`
- `KEYCLOAK_ADMIN_PASSWORD=admin`
- `KEYCLOAK_REALM=scranton-branch`

## 6. Startup and Health Rules

- All services must define `healthcheck`.
- `depends_on` must use `condition: service_healthy` where supported.
- Gateway starts after IAM and required backend services are healthy.
- Frontends start after gateway is healthy.

## 7. Required Commands

```bash
# full demo stack
docker compose -f platform/docker-compose.yml --profile app up -d

# infra only
docker compose -f platform/docker-compose.yml --profile infra up -d
```
