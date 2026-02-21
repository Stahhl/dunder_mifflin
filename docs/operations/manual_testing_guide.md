# Manual Testing Guide (PR1-PR12)

This runbook explains how to manually validate the currently implemented user workflows using Docker Compose and seeded users.

## 1. Prerequisites

- Docker Desktop (or Docker Engine) with Compose v2.
- Open ports from `.env` defaults (`8080`, `8081`, `3000`-`3004`, `5432`, `5672`, `8025`).

## 2. Start/Stop Commands

Initial setup:

```bash
cp .env.example .env
```

Bring up full stack (app profile includes infra dependencies):

```bash
docker compose --profile app up -d --build
```

Optional (infra-only debugging, without app services):

```bash
docker compose --profile infra up -d
```

Check container health:

```bash
docker compose ps
```

Stop everything:

```bash
docker compose down
```

Clean reset (removes DB/message data volumes):

```bash
docker compose down -v
```

## 3. URLs

- Gateway entrypoint: `http://localhost:8081`
- Keycloak login/admin: `http://localhost:8080`
- Portal web app: `http://localhost:3000`
- Infinity web app: `http://localhost:3001`
- Accounting web app: `http://localhost:3002`
- Warehouse mobile web (Expo web): `http://localhost:3004`
- MailHog: `http://localhost:8025`

Recommended auth entry routes (through gateway):

- Portal: `http://localhost:8081/portal`
- Infinity: `http://localhost:8081/infinity`
- Accounting: `http://localhost:8081/accounting`

## 4. Seeded Users for Role Testing

Default password for all users in the demo: `password`.

Core role test users:

- Sales: `jhalpert`
- Warehouse: `dphilbin`
- Accounting: `amartin`

Role expectations:

- `jhalpert` can access Portal + Infinity.
- `dphilbin` can access Portal + Warehouse; Sales routes should be denied.
- `amartin` can access Portal + Accounting.

## 5. Manual Test Scenarios

Use two browser windows/profiles when validating cross-role workflows.

### A. Auth Redirect + Role-Aware Access

1. Open `http://localhost:8081/infinity` in a private window.
2. Confirm redirect to Keycloak login.
3. Sign in as `jhalpert` / `password`.
4. Confirm you land in Infinity and can see order UI.
5. In a different private window, open `http://localhost:8081/infinity`.
6. Sign in as `dphilbin` / `password`.
7. Confirm Sales access is denied.

Expected:
- Unauthenticated users are redirected to Keycloak.
- Role checks are enforced after login.

### B. Infinity Sales: Create Order + History + Timeline

1. Log in as `jhalpert` and open Infinity.
2. In `Place Paper Order`, enter:
- `Client ID`: unique value (example `client_manual_<timestamp>`)
- `Requested ship date`: tomorrow
- `Product SKU`: `PPR-A4-WHT-500`
- `Quantity`: `3`
- `Notes`: any text
3. Click `Place Order`.
4. Confirm success message with `ord_...` ID.
5. In history, find the row with that order and click `View Timeline`.
6. Confirm timeline shows at least `CREATED`.

Expected:
- Order is created and visible in history.
- Timeline details load for selected order.

### C. Warehouse Dispatch (Cross-App with Sales)

1. Keep Infinity open as `jhalpert` with a newly created order.
2. Open `http://localhost:3004` in another window.
3. Click warehouse sign-in and log in as `dphilbin`.
4. Refresh shipments, open the shipment tied to the Sales order.
5. Enter mock scan values:
- barcode: `SKU:PPR-A4-WHT-500`
- qty: order quantity
6. Submit scan, then click dispatch.
7. Back in Infinity, refresh history/timeline.

Expected:
- Warehouse shows scan/dispatch success.
- Sales order status updates to `SHIPPED`.

### D. Warehouse Offline Queue + Replay

1. In warehouse app (`dphilbin`), open a pending shipment.
2. In browser devtools, set network offline.
3. Perform scan + dispatch actions.
4. Confirm queued action count increases.
5. Re-enable network, click sync/replay.
6. Confirm queue returns to zero.
7. In Infinity (`jhalpert`), verify order becomes `SHIPPED`.

Expected:
- Offline actions queue locally.
- Replay succeeds without duplicate side effects.

### E. Accounting Expense Decision

1. Open `http://localhost:8081/accounting`.
2. Log in as `amartin`.
3. Create an expense with unique description.
4. Confirm it appears as `PENDING`.
5. Select the expense, set decision to `REJECTED`, enter comment, submit.

Expected:
- Expense status changes to `REJECTED`.
- Decision comment is persisted/displayed.

### F. WUPHF Widget Notifications

1. In Infinity (`jhalpert`), place a new order.
2. Open WUPHF panel (header widget), refresh notifications.
3. Confirm an "Order ... created" notification appears.
4. Dispatch that order from warehouse (`dphilbin`).
5. Refresh widget and confirm "Order ... shipped" appears.
6. In Accounting (`amartin`), create + reject an expense.
7. Refresh widget and confirm expense decision notification appears.

Expected:
- Widget receives order + shipment + expense events.
- Notification click deep-links to relevant app context.

### G. Portal Profile & Preferences (PR12)

1. Open `http://localhost:8081/portal`.
2. Log in as `jhalpert`.
3. Open `Settings -> Profile & preferences`.
4. Update profile fields and set default app to `Infinity`.
5. Save and confirm success message.
6. Refresh page and verify values persist.
7. Log out, then log back in via `http://localhost:8081/portal`.

Expected:
- Profile fields persist across refresh.
- Default app preference is honored (redirects to Infinity route after login).

## 6. Optional API/Trace Spot Checks

Trace propagation check:

```bash
curl -i -H 'X-Trace-Id: 11111111111111111111111111111111' \
  -H 'X-Request-Id: req_manual_trace' \
  -H 'traceparent: 00-11111111111111111111111111111111-2222222222222222-01' \
  http://localhost:8081/api/v1/auth/me
```

Expected:
- `401` when unauthenticated.
- Response headers echo `x-trace-id`, `x-request-id`, and `traceparent`.

## 7. Automated Regression Commands (Docker)

Unit tests:

```bash
docker compose --profile test run --rm unit-tests
```

Order-service integration tests:

```bash
docker compose --profile test run --rm order-service-integration-tests
```

Golden E2E gate:

```bash
docker compose --profile test run --rm e2e-tests
```
