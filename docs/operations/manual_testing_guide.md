# Manual Testing Guide (PR1-PR12 + BI Phase A)

This runbook explains how to manually validate the currently implemented user workflows using Docker Compose and seeded users.

## 1. Prerequisites

- Docker Desktop (or Docker Engine) with Compose v2.
- Open ports from `.env` defaults (`8080`, `8081`, `3000`-`3006`, `5432`, `5672`, `8025`, `8097`, `8123`, `9000`, `9001`, `15672`).

## 2. Start/Stop Commands

Initial setup:

```bash
cp .env.example .env
```

Bring up full stack (app profile includes infra dependencies):

```bash
docker compose --profile app up -d --build
```

Bring up full stack using prebuilt images only (no local `docker build`):

```bash
# default in this repo is ghcr.io/stahhl; override only if you publish elsewhere
# IMAGE_REGISTRY=ghcr.io/<your-org-or-user>
# optional IMAGE_TAG defaults to main
docker compose -f docker-compose.yml -f docker-compose.prebuilt.yml --profile app up -d --no-build --pull always
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
- Grafana (observability): `http://localhost:3005`
- Metabase (BI UI): `http://localhost:3006`
- MailHog: `http://localhost:8025`
- RabbitMQ management: `http://localhost:15672`
- ClickHouse HTTP endpoint: `http://localhost:8123`
- MinIO API: `http://localhost:9000`
- MinIO console: `http://localhost:9001`
- BI ingestion health: `http://localhost:8097/actuator/health`

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
- Management: `mscott`
- IT support / observability: `nick`

Role expectations:

- `jhalpert` can access Portal + Infinity.
- `dphilbin` can access Portal + Warehouse; Sales routes should be denied.
- `amartin` can access Portal + Accounting.
- `mscott` can access Portal + Infinity + Warehouse + Accounting.
- `nick` is reserved for observability stack access (`it-support`) and should not have business app permissions by default.

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

### D. Infinity CRM Lead Conversion (PR11)

1. Open `http://localhost:8081/infinity`.
2. Sign in as `jhalpert`.
3. In the CRM form, create a lead:
- Company: unique value (`Dunder Client <timestamp>`)
- Contact name: `Pam Beesly`
- Contact email: unique email (`pam.<timestamp>@dundermifflin.test`)
- Phone: `570-555-0123`
4. Click `Create Lead`.
5. In the leads table, find the created `lead_...` row and click `Set QUALIFIED`.
6. Click `Convert` on that lead.
7. Confirm success message includes `client_...`.
8. Confirm order form `Client ID` is auto-filled with that `client_...`.
9. Place an order and verify history contains that client.

Expected:
- Lead transitions `NEW -> QUALIFIED -> CONVERTED`.
- Converted lead creates a stable `client_...` ID.
- Converted client is reusable in the order workflow.

### E. Warehouse Offline Queue + Replay

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

### F. Accounting Expense Decision

1. Open `http://localhost:8081/accounting`.
2. Log in as `amartin`.
3. Create an expense with unique description.
4. Confirm it appears as `PENDING`.
5. Select the expense, set decision to `REJECTED`, enter comment, submit.

Expected:
- Expense status changes to `REJECTED`.
- Decision comment is persisted/displayed.

### G. WUPHF Widget Notifications

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

### H. Portal Profile & Preferences (PR12)

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

### I. Observability Access Control (`it-support`)

1. Open `http://localhost:3005`.
2. Click `Sign in with Keycloak`.
3. Log in as `nick` / `password`.
4. Confirm Grafana loads and Prometheus datasource is available.
5. Log out.
6. Repeat with `jhalpert` / `password`.

Expected:
- `nick` can authenticate and view Grafana as read-only (`Viewer`).
- Non-`it-support` users are denied org-role assignment and cannot access dashboards.

### J. BI Platform Manual Validation (Phase A Foundation)

1. Start BI stack:
```bash
docker compose --profile bi up -d --build
```
2. Confirm BI dependencies are healthy:
```bash
curl -fsS http://localhost:8097/actuator/health | jq .
curl -fsS http://localhost:3006/api/health | jq .
curl -fsS http://localhost:9000/minio/health/ready
```
3. Produce new business events by running normal app flows:
- In Infinity (`jhalpert`), place an order.
- In Warehouse (`dphilbin`), dispatch that order.
- In Accounting (`amartin`), create + reject one expense.
4. Query ClickHouse curated facts:
```bash
curl -sS \
  -H 'X-ClickHouse-User: bi_ingestor' \
  -H 'X-ClickHouse-Key: bi_ingestor_password' \
  --data-binary "SELECT count() AS orders FROM bi_warehouse.fact_orders FORMAT TabSeparated" \
  http://localhost:8123/

curl -sS \
  -H 'X-ClickHouse-User: bi_ingestor' \
  -H 'X-ClickHouse-Key: bi_ingestor_password' \
  --data-binary "SELECT count() AS shipments FROM bi_warehouse.fact_shipments FORMAT TabSeparated" \
  http://localhost:8123/

curl -sS \
  -H 'X-ClickHouse-User: bi_ingestor' \
  -H 'X-ClickHouse-Key: bi_ingestor_password' \
  --data-binary "SELECT count() AS expenses FROM bi_warehouse.fact_expenses FORMAT TabSeparated" \
  http://localhost:8123/
```
5. Validate raw immutable store:
- Open MinIO console (`http://localhost:9001`), sign in with `minioadmin` / `minioadmin`.
- Confirm bucket `dmf-bi-raw-events` exists.
- Confirm event objects are written under date/type partitions.
6. Validate read-only BI credentials cannot mutate:
```bash
curl -i \
  -H 'X-ClickHouse-User: bi_reader' \
  -H 'X-ClickHouse-Key: bi_reader_password' \
  --data-binary "INSERT INTO bi_warehouse.fact_orders (event_id, order_id, client_id, created_by, requested_ship_date, item_count, total_quantity, occurred_at, ingested_at) VALUES ('evt_manual_denied','ord_manual_denied','client_manual','manual',NULL,1,1,now(),now())" \
  http://localhost:8123/
```

Expected:
- BI ingestion service stays healthy.
- Raw and curated BI tables populate from app-generated events.
- MinIO bucket receives raw event payloads.
- `bi_reader` write attempts fail.

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

BI replay/idempotency E2E:

```bash
docker compose --profile bi up -d --build
docker compose --profile bi --profile test run --rm bi-e2e-tests
```
