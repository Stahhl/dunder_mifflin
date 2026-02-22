# Platform Infra Assets

This folder contains mountable seed/config assets used by root-level Docker Compose files.

`docker-compose.yml` at repo root includes both:
- third-party infra services (`--profile infra`)
- frontend/backend app service build targets (`--profile app`)

Current app service Dockerfiles are placeholder scaffolds and should be replaced per service as implementation lands.

Seed helpers used by compose:
- `ldap-seed` one-shot job imports `platform/ldap/users.ldif` if users are missing.
- `keycloak-seed` one-shot job configures LDAP provider and ensures PR1 test users/roles exist.
- Seeded IT support account: `nick` (`it-support`) for observability-only access policy.

## Included Services

- PostgreSQL (`postgres`)
- RabbitMQ + Management UI (`rabbitmq`)
- OpenLDAP (`openldap`)
- Keycloak (`keycloak`)
- MailHog (`mailhog`)

## Seed and Config Mounts

- PostgreSQL init SQL: `platform/postgres/init/01-create-schemas.sql`
- RabbitMQ config: `platform/rabbitmq/rabbitmq.conf`
- RabbitMQ topology: `platform/rabbitmq/definitions.json`
- Keycloak realm import: `platform/keycloak/realm-export.json`
- LDAP users/groups seed: `platform/ldap/users.ldif`

## Usage

```bash
cp .env.example .env
docker compose --profile infra up -d

# run workspace unit tests in Docker
docker compose --profile test run --rm unit-tests

# run PR2 Playwright auth/navigation test
# requires app profile services to be up
docker compose --profile test run --rm e2e-tests
```

## Common Endpoints

- Keycloak: `http://localhost:8080`
- RabbitMQ UI: `http://localhost:15672`
- MailHog UI: `http://localhost:8025`
- PostgreSQL: `localhost:5432`
- LDAP: `localhost:389`
