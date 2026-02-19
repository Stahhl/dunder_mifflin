# Scranton Portal (`apps/portal`)

PR1 implementation scaffold for login bootstrap and role-aware portal navigation.

## Local run

```bash
pnpm install
pnpm dev:portal
```

## Environment

- `VITE_GATEWAY_BASE_URL` (optional): Gateway origin; defaults to same-origin when unset.

## PR1 behaviors implemented

- Auth bootstrap from `GET /api/v1/auth/me`
- Unauthenticated/session-expired redirect to `/oauth2/authorization/keycloak?returnTo=<current-url>`
- Header shell with app switcher and logout action
- Role-aware app visibility (`sales-associate`, `warehouse-operator`, `accountant`, `manager`, `portal-user`)
- Protected app routes in portal launcher
