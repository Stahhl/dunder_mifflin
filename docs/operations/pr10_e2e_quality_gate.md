# PR10 End-to-End Quality Gate

This document defines the PR10 merge-blocking quality gate for golden-path workflows.

## Gate Command Contract

- Golden path suite command: `pnpm test:e2e:golden`
- Flaky threshold check command: `pnpm test:e2e:flake-check`
- Combined gate command: `pnpm test:e2e:gate`
- Default flaky threshold: `PLAYWRIGHT_FLAKE_THRESHOLD_PERCENT=2`

The checker reads `test-results/playwright-results.json`, computes flaky rate, writes `test-results/flake-summary.json`, and fails when threshold is exceeded.

## CI Workflow Contract

- Workflow file: `.github/workflows/pr10-golden-path-gate.yml`
- Merge gate behavior:
  - Start full stack from `docker-compose.yml` using `infra` and `app` profiles.
  - Run:
    - `docker compose --profile test run --rm unit-tests`
    - `docker compose --profile test run --rm order-service-integration-tests`
    - `docker compose --profile test run --rm e2e-tests`
  - Any failure blocks the workflow.
- Artifacts uploaded on every run:
  - `test-results`
  - `playwright-report`

## Golden Specs in Scope

- `tests/e2e/specs/auth-sales-navigation.spec.ts`
- `tests/e2e/specs/sales-order-placement.spec.ts`
- `tests/e2e/specs/warehouse-dispatch.spec.ts`
- `tests/e2e/specs/sales-order-timeline.spec.ts`
- `tests/e2e/specs/accounting-expense-decision.spec.ts`
- `tests/e2e/specs/wuphf-notification-widget.spec.ts`
- `tests/e2e/specs/warehouse-offline-sync.spec.ts`
- `tests/e2e/specs/reliability-error-state.spec.ts`
- `tests/e2e/specs/infinity-crm-client-conversion.spec.ts`
