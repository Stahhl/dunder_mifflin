# Warehouse Mobile (`apps/warehouse-mobile`)

PR4 Expo app for warehouse scanning/dispatch.

## Local phone testing (QR)

Run backend in Docker:

```bash
docker compose --profile app up -d --build gateway order-service keycloak keycloak-seed postgres rabbitmq openldap ldap-seed
```

Run Expo on host (recommended for QR scanning):

```bash
cd apps/warehouse-mobile
npx expo start --tunnel
```

Use Expo Go to scan the QR code shown in terminal.

## Docker web build (used by E2E)

`docker compose --profile app up -d --build warehouse-mobile`

App URL: `http://localhost:3004`

## E2E

PR4 spec:

```bash
docker compose --profile test run --rm e2e-tests
```

This includes `tests/e2e/specs/warehouse-dispatch.spec.ts` and uses mock scanner mode.
