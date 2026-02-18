# Product Delivery TODO (PR-by-PR)

This roadmap breaks work into sequential PRs. Each PR is sized to be reviewable and to ship a visible user-facing improvement.

## Global Contract Baseline

- REST contracts: `docs/contracts/rest_api_v1.md`
- Event contracts: `docs/contracts/event_catalog_v1.md`
- IAM/RBAC mapping: `docs/architecture/identity_access.md`

## PR 1: Platform Login + App Navigation Shell
**User-visible outcome:** Users can sign in and navigate from one central portal to each department app.

**Scope**
- Build Scranton Portal shell with header, app switcher, and role-aware nav.
- Integrate OIDC login/logout flow against Keycloak through gateway.
- Add protected routes and unauthenticated redirect behavior.

**Acceptance**
- Users can log in as Sales, Warehouse, and Accounting test users.
- App links are shown/hidden by role.
- Session expiration redirects to login.

## PR 2: Sales Dashboard MVP (Leads Board)
**User-visible outcome:** Sales users can create and manage leads in the Infinity app.

**Scope**
- Create lead list + Kanban board in Infinity.
- Add create/edit/convert lead actions.
- Connect to `sales-service` lead endpoints with typed API client.

**Acceptance**
- New lead appears immediately in board.
- Lead stage changes persist after refresh.
- Conversion action emits expected backend request and success state.

## PR 3: Order Placement Flow from Sales
**User-visible outcome:** Sales users can place paper orders for converted clients.

**Scope**
- Add order creation UI in Infinity.
- Add product/quantity entry and validation.
- Persist orders through `order-service` via gateway.

**Acceptance**
- Valid orders can be submitted end-to-end.
- Order appears in order history with status.
- Validation blocks invalid quantities and missing client.

## PR 4: Warehouse Mobile MVP (Expo) - Scanner + Pick List
**User-visible outcome:** Warehouse users can scan items and process pending shipments from mobile.

**Scope**
- Bootstrap Expo app and auth flow.
- Add scanner screen and pending shipment list.
- Mark shipment as loaded/dispatched.

**Acceptance**
- Warehouse user can sign in on mobile build.
- Barcode scan populates shipment line item.
- Dispatch action updates shipment status visible to Sales.

## PR 5: Live Cross-App Order Status Sync
**User-visible outcome:** Sales sees real-time warehouse progress on each order.

**Scope**
- Add status timeline to Infinity order details.
- Consume backend status transitions (`RESERVED`, `SHIPPED`, `FAILED_INSUFFICIENT_STOCK`).
- Add polling (10s interval) or event-driven client updates.

**Acceptance**
- Shipment status change in warehouse reflects in sales within **15 seconds** end-to-end.
- Timeline persists and reloads correctly.
- Failed/insufficient stock statuses are visible and actionable.

## PR 6: Accounting Suite MVP - Expense Approval
**User-visible outcome:** Accounting users can review and approve/reject expenses.

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

**Scope**
- Add offline queue for warehouse mutations.
- Add sync status indicators and retry handling.
- Add idempotency keys for replay protection.

**Acceptance**
- Warehouse user can perform shipment actions offline.
- Actions sync correctly once connection returns.
- Duplicate side effects are prevented.

## PR 9: User-Facing Observability and Reliability Signals
**User-visible outcome:** Better transparency and fewer silent failures for users.

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

**Scope**
- Implement Playwright flows for:
- Sales lead-to-order
- Warehouse dispatch
- Accounting expense approval
- Add CI gate that blocks merge on failing golden paths.

**Acceptance**
- E2E suite runs in CI against `platform/docker-compose.yml`.
- Golden-path failures block merge.
- Flaky tests are tracked and kept below agreed threshold.

## Optional Follow-On PRs (after MVP)
- PR 11: Commission calculator and sales analytics widgets.
- PR 12: Warehouse safety checklist + baler lock workflow.
- PR 13: PPC calendar + conference room booking in portal.
- PR 14: Role delegation/admin tools in profile service UI.
