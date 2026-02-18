# Angular Frontend Design Document

## 1. Scope
This standard applies to Angular-based frontend applications, currently the **Accounting & Finance Suite**.

## 2. Technology Stack

*   **Framework:** Angular (latest LTS, v18+)
*   **Language:** TypeScript (`strict` + Angular strict template checks)
*   **Build System:** Nx or Angular CLI
*   **State Management:** Angular Signals for local state, NgRx for complex cross-module state
*   **Styling:** Angular Material + shared Sabre design tokens
*   **Package Manager:** pnpm or npm

## 3. Recommended Application Structure

```
frontend/accounting-suite/
├── src/app/core/            # Singleton services, interceptors, app config
├── src/app/shared/          # Reusable presentational components/pipes/directives
├── src/app/features/        # Lazy-loaded business modules
├── src/app/state/           # NgRx store/effects/selectors (if required)
└── Dockerfile               # App-owned build/runtime image definition
```

## 4. Communication & Data Fetching

*   Use Angular `HttpClient` with typed request/response models.
*   Generate API clients from OpenAPI specs; do not handcraft duplicate DTOs.
*   Use RxJS operators for retries, cancellation, and debouncing.

## 5. Authentication & Security

*   Use OIDC/OAuth2 with PKCE via `angular-auth-oidc-client`.
*   Protect routes with guards.
*   Attach bearer tokens via HTTP interceptor.
*   Enforce role-based UI control at route and component boundaries.

## 6. Observability

*   Use OpenTelemetry web tracing and propagate `traceparent` headers.
*   Send unhandled exceptions to centralized error aggregation with trace context.

## 7. Testing

*   **Unit:** Jest for components, services, reducers, and utility functions.
*   **Component/Integration:** Angular Testing Library + MSW for API mocks.
*   **E2E:** Playwright for core flows (login, ledger review, expense approval).

## 8. Quality Gates

*   ESLint (`@angular-eslint`) and Prettier are required.
*   `ng build` and `tsc --noEmit` must pass in CI.
*   Enforce minimum coverage threshold for changed modules.

## 9. Deployment

*   Build with production configuration.
*   Serve static output via CDN/NGINX with SPA fallback to `index.html`.
