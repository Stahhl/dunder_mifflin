# End-to-End Testing Strategy

## 1. Goal

Validate the demo's golden user journeys across gateway, services, and frontend apps.

Host dependency: Docker with Docker Compose v2 plugin.

## 2. Tooling

- Unit tests: Vitest (Portal) via Docker Compose `test` profile (`unit-tests` service).
- Framework: Playwright (TypeScript).
- Runtime: Docker Compose `e2e` profile.
- Artifacts: traces, screenshots, and videos on failure.

## 3. Environment

- Bring up full stack with seeded users/data.
- Use stable test credentials from `docs/architecture/identity_access.md`.
- Reset test data between suites or isolate via unique IDs.

Unit test command:

```bash
docker compose --profile test run --rm unit-tests
```

## 4. Golden Path Specs

1. Sales lead-to-order:
- Sales user logs in.
- Creates lead, moves stages, converts lead.
- Places order and sees order in history.

2. Warehouse dispatch:
- Warehouse user logs in.
- Opens pending shipment.
- Scans line item and dispatches shipment.
- Sales timeline reflects status within SLA.

3. Accounting expense approval:
- Manager submits expense.
- Accountant approves/rejects with comment.
- Submitter sees final decision and reason.

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
│   ├── sales-lead-order.spec.ts
│   ├── warehouse-dispatch.spec.ts
│   └── accounting-expense.spec.ts
└── utils/
    ├── api-client.ts
    └── seed-client.ts
```

## 6. CI Gate

- PR10 enables mandatory E2E merge gate.
- Any failing golden path blocks merge.
- Flake rate must stay below agreed threshold (default: 2% rolling 14 days).
