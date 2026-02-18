# Frontend Implementation Standards

## 1. Scope

These standards apply to:
- `apps/portal` (React)
- `apps/infinity` (React)
- `apps/warehouse-mobile` (Expo React Native)
- `apps/accounting` (Angular)
- `apps/wuphf-widget` (Web Component)

## 2. Languages and Tooling

- TypeScript strict mode in every app.
- Package manager: `pnpm` (preferred) or `npm`.
- Linting: ESLint.
- Formatting: Prettier.
- Unit tests: Vitest/Jest for React apps, Jest for Angular, Jest for widget.

## 3. App-Specific Baselines

### React apps (Portal, Infinity)
- Vite + React Router.
- Data fetching via typed API client generated from `docs/contracts/rest_api_v1.md`.
- Route guards based on `/api/v1/auth/me` and role checks.

### Warehouse Mobile (Expo)
- Expo Router or React Navigation.
- Auth with OIDC PKCE (Keycloak `warehouse-mobile` client).
- Offline queue for shipment mutations with idempotency keys.

### Accounting (Angular)
- Standalone components preferred.
- Angular router guards using gateway auth endpoints.
- Typed data-access layer matching REST contracts.

### WUPHF widget
- Web Component with framework-agnostic API.
- Must embed without host framework coupling.

## 4. API and Auth Rules

- Browser apps authenticate through gateway session flow; no local storage of bearer tokens.
- Mobile app may hold short-lived access token in secure storage.
- All API requests include trace headers when available.
- 401/403 handling must show clear action (relogin/request access).

## 5. UX and Reliability Rules

- Loading, empty, and error states are required for every async screen.
- Optimistic updates allowed only when rollback behavior is defined.
- Forms must validate both field-level and submit-level constraints.
- Session expiration must redirect to login.

## 6. Testing Requirements

- Unit test minimum for business-critical components.
- Component/integration tests for lead board, order form, expense decision, and dispatch flows.
- E2E flows defined in `docs/guidelines/testing_strategy.md` are merge blockers once PR10 lands.
