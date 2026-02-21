# End-to-End Testing Strategy

## 1. Goal

Validate the demo's golden user journeys across gateway, services, and frontend apps.

Host dependency: Docker with Docker Compose v2 plugin.

## 2. Tooling

- Unit tests: Vitest (Portal) + Node test runner (`order-service`) via Docker Compose `test` profile (`unit-tests` service).
- Integration tests: `order-service` Postgres + RabbitMQ adapter checks via Docker Compose `test` profile (`order-service-integration-tests` service).
- Framework: Playwright (TypeScript).
- Runtime: Docker Compose `test` profile (`e2e-tests` service).
- Artifacts: traces, screenshots, videos on failure + JSON/JUnit reports.

## 3. Environment

- Bring up full stack with seeded users/data.
- Use stable test credentials from `docs/architecture/identity_access.md`.
- Reset test data between suites or isolate via unique IDs.

Unit test command:

```bash
docker compose --profile test run --rm unit-tests
```

Order backend integration command:

```bash
docker compose --profile test run --rm order-service-integration-tests
```

Playwright PR10 golden gate command:

```bash
# requires app profile services to be up
docker compose --profile test run --rm e2e-tests
```

Underlying e2e gate command:

```bash
pnpm test:e2e:gate
```

## 4. Golden Path Specs

1. PR2 auth and app navigation gate:
- Sales user opens Sales app route unauthenticated.
- Gateway redirects to Keycloak login.
- User signs in with PR1 seeded credentials.
- Browser is redirected back to Sales app route.

2. PR3 sales order placement:
- Sales user logs in.
- Validation blocks invalid order payloads (missing customer, invalid quantity).
- Sales user places order via Infinity.
- Order appears in Infinity history with `CREATED` status.

3. Warehouse dispatch:
- Warehouse user logs in.
- Opens pending shipment.
- Scans line item and dispatches shipment.
- Sales timeline reflects status within SLA.

4. Accounting expense approval:
- Manager submits expense.
- Accountant approves/rejects with comment.
- Submitter sees final decision and reason.

5. WUPHF cross-app notifications:
- Order and expense events appear in widget.
- Deep links open expected app screens.

6. Warehouse offline sync replay:
- Mutations queue while network is unavailable.
- Replay succeeds with idempotent backend behavior.

7. Reliability error-state behavior:
- Frontend error boundaries render user-friendly fallback UI.
- Gateway/service trace headers and trace IDs are propagated.

## 5. Required Structure

```text
tests/e2e/
├── config/
│   ├── playwright.config.ts
│   └── global-setup.ts
├── fixtures/
│   ├── users.json
│   └── products.json
├── specs/
│   ├── auth-sales-navigation.spec.ts
│   ├── sales-order-placement.spec.ts
│   ├── warehouse-dispatch.spec.ts
│   ├── sales-order-timeline.spec.ts
│   ├── accounting-expense-decision.spec.ts
│   ├── wuphf-notification-widget.spec.ts
│   ├── warehouse-offline-sync.spec.ts
│   └── reliability-error-state.spec.ts
├── scripts/
│   └── check-flake-rate.mjs
└── utils/
    ├── api-client.ts
    └── seed-client.ts
```

## 6. CI Gate

- PR10 enables mandatory E2E merge gate.
- Any failing golden path blocks merge.
- Workflow: `.github/workflows/pr10-golden-path-gate.yml`.
- The gate runs full Docker stack (`infra` + `app`) plus all `test` profile checks.
- Flake rate must stay below threshold (default `2%`, enforced by `tests/e2e/scripts/check-flake-rate.mjs`).
