# PR9 Reliability Signals Contract

This document defines the user-facing reliability signals introduced in PR9.

## Frontend Reliability UX

- All user apps now include a top-level render error boundary fallback:
  - `apps/portal`
  - `apps/infinity`
  - `apps/accounting`
  - `apps/warehouse-mobile`
- Fallback UX contract:
  - Show a clear message instead of blank content.
  - Provide a `Reload app` action.
  - Preserve normal behavior when no rendering error is present.

## Trace Propagation Contract

- Browser clients attach these headers on API calls to gateway:
  - `traceparent`
  - `X-Trace-Id`
  - `X-Request-Id`
- Gateway behavior:
  - Ensures trace headers exist on every response.
  - Forwards trace headers to downstream domain services.
- Domain services behavior:
  - Echo trace headers on responses.
  - Include `traceId` in structured error envelopes for exception-handler responses.

## Dashboard/Alert Inputs (Operational Contract)

These are the minimum signals that should feed Grafana dashboards and alert rules:

1. Login failures
- Source: gateway `401/403` response rates on auth-protected app routes.
- Suggested alert: `auth_failure_rate > 5% for 5m`.

2. Order latency
- Source: `POST /api/v1/orders` end-to-end latency at gateway.
- Suggested alert: `p95 > 2s for 10m`.

3. Shipment sync errors
- Source: `POST /api/v1/warehouse/shipments/*` non-2xx rates and offline queue replay failures.
- Suggested alert: `shipment_sync_error_rate > 2% for 10m`.

## Regression Coverage

- `tests/e2e/specs/reliability-error-state.spec.ts`
  - Verifies gateway trace headers are returned.
  - Verifies friendly error-boundary fallback across all user apps.
