# Product Delivery TODO (PR-by-PR)

This roadmap breaks work into sequential PRs. Each PR is sized to be reviewable and to ship a visible user-facing improvement.

## Global Contract Baseline

- REST contracts: `docs/contracts/rest_api_v1.md`
- Event contracts: `docs/contracts/event_catalog_v1.md`
- IAM/RBAC mapping: `docs/architecture/identity_access.md`

## Component Delivery Map (Frontend + Backend)

| PR | Frontend in Scope | Backend in Scope | Notes |
|---|---|---|---|
| PR1 | `apps/portal` | `services/gateway` | Portal shell + web login/session foundation. |
| PR2 | `apps/portal`, Sales entry route (Infinity placeholder) | `services/gateway` | Infinity is intentionally placeholder-only in this step. |
| PR3 | Infinity order UI (currently served by gateway route) | `services/gateway`, `services/order-service` | First real Sales business flow (orders). |
| PR4 | `apps/warehouse-mobile` (Expo) | `services/gateway`, shipment APIs (implemented through order domain for MVP) | Mobile PKCE + scanner/pick/dispatch MVP. |
| PR5 | Infinity order timeline UX | `services/gateway` (SSE), order/inventory status event flow | Real-time cross-app status sync. |
| PR6 | `apps/accounting` | `services/gateway`, `services/finance-service` | Expense approval workflow. |
| PR7 | `apps/wuphf-widget` integrated into Portal/Infinity/Accounting | `services/gateway`, `services/wuphf-service` | Unified notification UX. |
| PR8 | `apps/warehouse-mobile` offline queue/sync UX | Warehouse/order backend idempotent mutation handling | Offline-first safety and replay. |
| PR9 | Portal/Infinity/Warehouse/Accounting reliability UX | Gateway + all domain services observability/error standards | User-facing reliability + tracing. |
| PR10 | `tests/e2e` golden-path suite | Full app/backend stack in CI | Merge gate for end-to-end quality. |

## PR 1: Platform Login + App Navigation Shell
**User-visible outcome:** Users can sign in and navigate from one central portal to each department app.

**Included Components**
- Frontend: `apps/portal`
- Backend: `services/gateway` (auth/session/bootstrap endpoints)
- Infra/Auth dependencies: Keycloak + LDAP seed + gateway web session flow

**Scope**
- Build Scranton Portal shell with header, app switcher, and role-aware nav.
- Integrate OIDC login/logout flow against Keycloak through gateway.
- Add protected routes and unauthenticated redirect behavior.

**Acceptance**
- Users can log in as Sales, Warehouse, and Accounting test users.
- App links are shown/hidden by role.
- Session expiration redirects to login.

## PR 2: Sales App Access Flow (Gateway + Keycloak)
**User-visible outcome:** Sales users can reach the Sales app through the gateway login flow.

**Included Components**
- Frontend: `apps/portal` navigation + Infinity destination route as placeholder
- Backend: `services/gateway` (route protection, redirects, role checks)
- Explicit non-goal: no real Infinity business UI yet

**Scope**
- Add Sales app entry point/routing from portal through gateway.
- Enforce unauthenticated redirect to Keycloak and return to Sales app after successful login.
- Keep Sales app content as a placeholder page (no lead/order business functionality yet).
- Add Playwright E2E coverage for this auth/navigation flow.

**Acceptance**
- Sales staff user is redirected to Keycloak when opening Sales app unauthenticated.
- After successful login, user returns to Sales app route through gateway session flow.
- Playwright E2E test for this flow passes.

## PR 3: Order Placement Flow from Sales
**User-visible outcome:** Sales users can place paper orders from Infinity.

**Included Components**
- Frontend: Infinity order form/history UX (currently delivered via gateway-hosted Infinity page)
- Backend: `services/gateway` (`/api/v1/orders*` routing/authz), `services/order-service` (persistence + order events)
- Infra dependencies: PostgreSQL + RabbitMQ

**Scope**
- Add order creation UI in Infinity.
- Add customer/product/quantity entry and validation.
- Persist orders through `order-service` via gateway.

**Acceptance**
- Valid orders can be submitted end-to-end.
- Order appears in order history with status.
- Validation blocks invalid quantities and missing customer.

## PR 4: Warehouse Mobile MVP (Expo) - Scanner + Pick List
**User-visible outcome:** Warehouse users can scan items and process pending shipments from mobile.

**Included Components**
- Frontend: `apps/warehouse-mobile` (Expo)
- Backend: `services/gateway` warehouse routes + shipment mutation/read APIs
- Auth: direct Keycloak Authorization Code + PKCE for mobile client (`warehouse-mobile`)
- MVP implementation note: shipment workflow may be backed by order-domain adapters until dedicated inventory implementation is expanded

**Scope**
- Bootstrap Expo app and auth flow.
- Use direct Keycloak Authorization Code + PKCE for mobile login.
- Add scanner screen and pending shipment list.
- Mark shipment as loaded/dispatched.

**Acceptance**
- Warehouse user can sign in on mobile build.
- Barcode scan populates shipment line item.
- Dispatch action updates shipment status visible to Sales.

## PR 5: Live Cross-App Order Status Sync
**User-visible outcome:** Sales sees real-time warehouse progress on each order.

**Included Components**
- Frontend: Infinity order timeline/status UX
- Backend: gateway SSE stream support + order/inventory status transitions and event propagation

**Scope**
- Add status timeline to Infinity order details.
- Consume backend status transitions (`RESERVED`, `SHIPPED`, `FAILED_INSUFFICIENT_STOCK`).
- Add event-driven client updates (SSE through gateway).

**Acceptance**
- Shipment status change in warehouse reflects in sales within **15 seconds** end-to-end.
- Timeline persists and reloads correctly.
- Failed/insufficient stock statuses are visible and actionable.

## PR 6: Accounting Suite MVP - Expense Approval
**User-visible outcome:** Accounting users can review and approve/reject expenses.

**Included Components**
- Frontend: `apps/accounting`
- Backend: `services/gateway` expense routes + `services/finance-service` decision workflow

**Scope**
- Build Angular expense queue and detail views.
- Add approve/reject actions with reason capture.
- Add manager-side submission status view.

**Acceptance**
- Accountant can approve/reject from queue.
- Decision and comment are stored and visible to submitter.
- Rejected expenses show reason in manager view.

## PR 7: WUPHF Notification Widget v1
**User-visible outcome:** Users receive unified in-app notifications for key workflows.

**Included Components**
- Frontend: `apps/wuphf-widget` + integration in portal/infinity/accounting hosts
- Backend: `services/wuphf-service` + gateway notification APIs

**Scope**
- Implement embeddable Web Component notification center.
- Integrate into Portal and Infinity.
- Show notifications for order placed, shipment dispatched, expense decision.

**Acceptance**
- Widget renders consistently in both host apps.
- Notification click deep-links to the correct page.
- Unread/read state is persisted per user.

## PR 8: Warehouse Offline-First Sync
**User-visible outcome:** Warehouse app remains usable during network drops and syncs safely when online.

**Included Components**
- Frontend: `apps/warehouse-mobile` offline queue/retry UX
- Backend: idempotency and dedupe handling across warehouse/order mutation paths

**Scope**
- Add offline queue for warehouse mutations.
- Add sync status indicators and retry handling.
- Add idempotency keys for retry deduplication protection.

**Acceptance**
- Warehouse user can perform shipment actions offline.
- Actions sync correctly once connection returns.
- Duplicate side effects are prevented.

## PR 9: User-Facing Observability and Reliability Signals
**User-visible outcome:** Better transparency and fewer silent failures for users.

**Included Components**
- Frontend: portal/infinity/warehouse/accounting error boundaries and trace propagation
- Backend: gateway + domain services tracing, metrics, alerting contracts

**Scope**
- Add consistent frontend error boundaries and friendly failure states.
- Add request tracing propagation from frontend to gateway.
- Create dashboards/alerts for login failures, order latency, shipment sync errors.

**Acceptance**
- Users see actionable error UI instead of blank states.
- Key flows emit trace IDs through frontend + backend hops.
- Alerts trigger for defined SLO violations.

## PR 10: End-to-End Quality Gate for Golden Paths
**User-visible outcome:** Core user workflows become stable and regression-resistant.

**Included Components**
- Frontend tests: `tests/e2e/specs/*` golden-path flows
- Backend/system scope: full docker-compose stack exercised in CI gate

**Scope**
- Implement Playwright flows for:
- Sales lead-to-order
- Warehouse dispatch
- Accounting expense approval
- Add CI gate that blocks merge on failing golden paths.

**Acceptance**
- E2E suite runs in CI against `docker-compose.yml`.
- Golden-path failures block merge.
- Flaky tests are tracked and kept below agreed threshold.

## Optional Follow-On PRs (after MVP)
- PR 11: Commission calculator and sales analytics widgets.
- PR 12: Warehouse safety checklist + baler lock workflow.
- PR 13: PPC calendar + conference room booking in portal.
- PR 14: Role delegation/admin tools in profile service UI.
