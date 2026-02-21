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
| PR2 | `apps/portal` (Sales entry route only) | `services/gateway` | Infinity remains placeholder-only in this step. |
| PR3 | Infinity order UI (gateway-hosted route) | `services/gateway`, `services/order-service` | First real Sales order flow. |
| PR4 | `apps/warehouse-mobile` (Expo) | `services/gateway`, shipment APIs (MVP adapter on order domain) | Mobile PKCE + scanner/pick/dispatch MVP. |
| PR5 | `apps/infinity` standalone app + order timeline UX | `services/gateway` (SSE), `services/order-service`, `services/inventory-service` integration | Moves Infinity out of gateway-rendered HTML. |
| PR6 | `apps/accounting` | `services/gateway`, `services/finance-service` | Expense approval workflow. |
| PR7 | `apps/wuphf-widget` integrated into Portal/Infinity/Accounting | `services/gateway`, `services/wuphf-service` | Unified notification UX. |
| PR8 | `apps/warehouse-mobile` offline queue/sync UX | `services/inventory-service` warehouse ownership + idempotent mutation handling | Offline-first safety and replay. |
| PR9 | Portal/Infinity/Warehouse/Accounting reliability UX | Gateway + all in-scope domain services observability/error standards | User-facing reliability + tracing. |
| PR10 | `tests/e2e` golden-path suite | Full app/backend stack in CI | Merge gate for end-to-end quality. |
| PR11 | `apps/infinity` CRM leads/clients experience | `services/gateway`, `services/sales-service` | First dedicated Sales CRM domain service rollout. |
| PR12 | `apps/portal` user profile/preferences | `services/gateway`, `services/profile-service` | User self-service profile and defaults. |

## Component First-Delivery Matrix

| Component | Type | First PR | Notes |
|---|---|---|---|
| `apps/portal` | Frontend app | PR1 | Platform shell and app launcher. |
| `apps/infinity` | Frontend app | PR5 | PR3 delivers Infinity UX via gateway route; PR5 extracts to standalone app. |
| `apps/warehouse-mobile` | Frontend app | PR4 | Expo mobile/web MVP for warehouse operators. |
| `apps/accounting` | Frontend app | PR6 | Accounting queue and decisions. |
| `apps/wuphf-widget` | Frontend app/widget | PR7 | Shared widget embedded in host apps. |
| `services/gateway` | Backend service | PR1 | Auth/session entrypoint, routing, and aggregation. |
| `services/order-service` | Backend service | PR3 | Order create/list + early shipment adapter. |
| `services/finance-service` | Backend service | PR6 | Expense review workflow. |
| `services/wuphf-service` | Backend service | PR7 | Notifications API/events. |
| `services/inventory-service` | Backend service | PR8 | Becomes primary warehouse shipment owner. |
| `services/sales-service` | Backend service | PR11 | Lead/client CRM domain for Infinity sales workflows. |
| `services/profile-service` | Backend service | PR12 | User profile/preferences domain backing Portal settings. |
| `tests/e2e` | Quality gate | PR2 | Starts in PR2, hardens in PR10 gate, then expands with PR11+ specs. |

## Current E2E Coverage by PR

| PR | Current or Planned E2E Coverage |
|---|---|
| PR2 | `tests/e2e/specs/auth-sales-navigation.spec.ts` |
| PR3 | `tests/e2e/specs/sales-order-placement.spec.ts` |
| PR4 | `tests/e2e/specs/warehouse-dispatch.spec.ts` |
| PR5 | `tests/e2e/specs/sales-order-timeline.spec.ts` |
| PR6 | `tests/e2e/specs/accounting-expense-decision.spec.ts` |
| PR7 | `tests/e2e/specs/wuphf-notification-widget.spec.ts` |
| PR8 | `tests/e2e/specs/warehouse-offline-sync.spec.ts` |
| PR9 | `tests/e2e/specs/reliability-error-state.spec.ts` |
| PR10 | `.github/workflows/pr10-golden-path-gate.yml` + `pnpm test:e2e:gate` aggregate gate |
| PR11 | `tests/e2e/specs/infinity-crm-client-conversion.spec.ts` |
| PR12 | `tests/e2e/specs/portal-profile-preferences.spec.ts` |

## PR 1: Platform Login + App Navigation Shell
**User-visible outcome:** Users can sign in and navigate from one central portal to each department app.

**Included Components**
- Frontend apps: `apps/portal`
- Backend services: `services/gateway` (auth/session/bootstrap endpoints)
- Infra/Auth dependencies: Keycloak + LDAP seed + gateway web session flow
- Non-goals: no Sales/Warehouse/Accounting business workflows yet
- E2E coverage: established in PR2

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
- Frontend apps: `apps/portal` navigation + Infinity destination route as placeholder
- Backend services: `services/gateway` (route protection, redirects, role checks)
- Infra/Auth dependencies: Keycloak OIDC realm/client config
- Non-goals: no real Infinity business UI yet
- E2E coverage: `tests/e2e/specs/auth-sales-navigation.spec.ts`

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
- Frontend apps: Infinity order form/history UX delivered via gateway-hosted `/infinity` page
- Backend services: `services/gateway` (`/api/v1/orders*` routing/authz), `services/order-service` (persistence + order events)
- Infra dependencies: PostgreSQL + RabbitMQ
- Non-goals: standalone `apps/infinity` web app package
- E2E coverage: `tests/e2e/specs/sales-order-placement.spec.ts`

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
- Frontend apps: `apps/warehouse-mobile` (Expo)
- Backend services: `services/gateway` warehouse routes + shipment mutation/read APIs (MVP adapter using order domain)
- Infra/Auth dependencies: Keycloak mobile client (`warehouse-mobile`) + PKCE
- Non-goals: dedicated `inventory-service` ownership of warehouse endpoints
- E2E coverage: `tests/e2e/specs/warehouse-dispatch.spec.ts`

**Scope**
- Bootstrap Expo app and auth flow.
- Use direct Keycloak Authorization Code + PKCE for mobile login.
- Add scanner screen and pending shipment list.
- Mark shipment as loaded/dispatched.

**Acceptance**
- Warehouse user can sign in on mobile build.
- Barcode scan populates shipment line item.
- Dispatch action updates shipment status visible to Sales.

## PR 5: Infinity Standalone App + Live Cross-App Order Status Sync
**User-visible outcome:** Sales uses a real Infinity web app and sees real-time warehouse progress on each order.

**Included Components**
- Frontend apps: `apps/infinity` (standalone app) with order timeline/status UX
- Backend services: `services/gateway` (SSE stream support and authz), `services/order-service`, `services/inventory-service` event integration
- Infra dependencies: RabbitMQ event flow + compose wiring for Infinity web container
- Non-goals: Sales CRM lead pipeline (`services/sales-service`) in this PR
- E2E coverage: `tests/e2e/specs/sales-order-timeline.spec.ts`

**Scope**
- Extract current gateway-rendered Infinity UI into `apps/infinity`.
- Serve Infinity via dedicated app container while keeping gateway as auth/API edge.
- Add order status timeline/details view in Infinity.
- Consume backend status transitions (`RESERVED`, `SHIPPED`, `FAILED_INSUFFICIENT_STOCK`) via SSE.

**Acceptance**
- `/infinity` no longer depends on embedded HTML in gateway controller.
- Shipment status changes are reflected in Infinity within **15 seconds** end-to-end.
- Timeline state persists and reloads correctly.

## PR 6: Accounting Suite MVP - Expense Approval
**User-visible outcome:** Accounting users can review and approve/reject expenses.

**Included Components**
- Frontend apps: `apps/accounting`
- Backend services: `services/gateway` expense routes + `services/finance-service` decision workflow
- Infra dependencies: PostgreSQL + RabbitMQ as required by finance workflows
- Non-goals: cross-app notification center behavior
- E2E coverage: `tests/e2e/specs/accounting-expense-decision.spec.ts`

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
- Frontend apps: `apps/wuphf-widget` + integration in Portal/Infinity/Accounting hosts
- Backend services: `services/gateway` notification routes + `services/wuphf-service`
- Infra dependencies: notification/event delivery path through message broker
- Non-goals: warehouse offline synchronization rules
- E2E coverage: planned widget integration spec

**Scope**
- Implement embeddable Web Component notification center.
- Integrate into Portal and Infinity.
- Show notifications for order placed, shipment dispatched, expense decision.

**Acceptance**
- Widget renders consistently in both host apps.
- Notification click deep-links to the correct page.
- Unread/read state is persisted per user.

## PR 8: Warehouse Offline-First Sync + Inventory Service Handoff
**User-visible outcome:** Warehouse app remains usable during network drops and syncs safely when online.

**Included Components**
- Frontend apps: `apps/warehouse-mobile` offline queue/retry UX
- Backend services: `services/inventory-service` primary shipment API ownership + idempotency/dedupe handling across mutation paths
- Infra dependencies: durable queue/event transport for safe replay
- Non-goals: accounting-specific workflow expansion
- E2E coverage: `tests/e2e/specs/warehouse-offline-sync.spec.ts`

**Scope**
- Add offline queue for warehouse mutations.
- Add sync status indicators and retry handling.
- Add idempotency keys for retry dedupe.
- Shift warehouse endpoint ownership from order-domain adapter to inventory-domain implementation.

**Acceptance**
- Warehouse user can perform shipment actions offline.
- Actions sync correctly once connection returns.
- Duplicate side effects are prevented.

## PR 9: User-Facing Observability and Reliability Signals
**User-visible outcome:** Better transparency and fewer silent failures for users.

**Included Components**
- Frontend apps: Portal/Infinity/Warehouse/Accounting error boundaries and trace propagation
- Backend services: gateway + all in-scope domain services tracing, metrics, alerting contracts
- Infra dependencies: metrics/tracing/alerting stack used by all active services
- Non-goals: new line-of-business features
- E2E coverage: `tests/e2e/specs/reliability-error-state.spec.ts`

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
- Infra dependencies: CI environment with compose profiles for infra + apps + services
- Non-goals: adding new product functionality
- E2E coverage: aggregate gate over PR2-PR11 required specs

**Scope**
- Implement and stabilize Playwright flows for Sales, Warehouse, Accounting, and notification cross-app behaviors.
- Add CI gate that blocks merge on failing golden paths.
- Track and reduce flaky tests.
- Publish operational gate contract for commands, artifacts, and threshold handling.

**Acceptance**
- E2E suite runs in CI against `docker-compose.yml`.
- Golden-path failures block merge.
- Flaky tests are tracked and kept below agreed threshold.
- CI gate implementation lives in `.github/workflows/pr10-golden-path-gate.yml`.

## PR 11: Sales CRM Foundation (Leads + Client Conversion)
**User-visible outcome:** Sales staff can manage leads in Infinity and convert qualified leads into clients used by order workflows.

**Included Components**
- Frontend apps: `apps/infinity` CRM workspace (lead list/detail, conversion actions)
- Backend services: `services/gateway` (`/api/v1/sales/*` routing/authz), `services/sales-service` (lead/client domain + persistence)
- Infra dependencies: PostgreSQL persistence for sales CRM data + domain event publication for conversions
- Non-goals: commissions, forecasting, and territory analytics
- E2E coverage: `tests/e2e/specs/infinity-crm-client-conversion.spec.ts`

**Scope**
- Add Infinity CRM routes for lead backlog, lead detail, and conversion workflow.
- Implement `sales-service` endpoints for lead create/list/get/update and lead-to-client conversion.
- Define conversion behavior that creates immutable client records and links originating lead.
- Expose converted clients to Infinity order entry selectors to reduce manual client ID entry.
- Emit client conversion domain events for downstream integrations.

**Acceptance**
- Sales-associate user can create and update leads with status progression.
- Converting a qualified lead creates a client with stable client ID and conversion timestamp.
- Converted client is selectable in Infinity order placement flow.
- Unauthorized roles cannot mutate sales CRM entities.
- E2E flow from lead creation to successful conversion passes.

## PR 12: User Profile and Preferences Service
**User-visible outcome:** Users can manage personal profile settings in Portal and have preferences persist across sessions and apps.

**Included Components**
- Frontend apps: `apps/portal` profile and preferences settings pages
- Backend services: `services/gateway` (`/api/v1/profile/*` routing/authz), `services/profile-service` (profile/preferences domain + persistence)
- Infra dependencies: user identity linkage to Keycloak subject IDs + PostgreSQL persistence for profile records
- Non-goals: role delegation/admin policy controls (PR16), advanced notification workflows
- E2E coverage: `tests/e2e/specs/portal-profile-preferences.spec.ts`

**Scope**
- Add Portal settings UI for profile details and application preferences.
- Implement `profile-service` endpoints for current-user profile read/update.
- Persist preference keys including default landing app and notification defaults.
- Apply saved default app preference at post-login app selection/redirect flow.
- Publish profile-updated events for optional downstream consumers.

**Acceptance**
- Logged-in user can view and update own profile fields and preferences.
- Preferences persist after logout/login and browser refresh.
- Default app preference is honored on next authenticated navigation flow.
- Users cannot read or modify another user profile through API.
- E2E flow for profile update and persisted preference verification passes.

## Optional Follow-On PRs (after PR12)
- PR 13: Commission calculator and sales analytics widgets.
- PR 14: Warehouse safety checklist + baler lock workflow.
- PR 15: PPC calendar + conference room booking in portal.
- PR 16: Role delegation/admin tools in profile service UI.
