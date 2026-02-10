# Frontend Services Design Document

## 1. Overview
This document outlines the architectural standards and implementation guidelines for the Dunder Mifflin frontend applications. We will adopt a **Micro-Frontend** strategy (managed via a Monorepo) to support distinct departmental needs while sharing core "Sabre" UI components.

## 2. Technology Stack

*   **Framework:** Angular (Latest LTS - v18+)
*   **Language:** TypeScript (Strict Mode required)
*   **Build System:** Nx (Monorepo management) or Angular CLI
*   **State Management:** Angular Signals (for local state) & NgRx (for global enterprise state).
*   **Styling:** 
    *   **Framework:** Angular Material (for that "Corporate/Enterprise" look).
    *   **Utilities:** Tailwind CSS (for layout and spacing).
*   **Package Manager:** pnpm or npm.

## 3. Architecture Pattern: Nx Monorepo

We will use an **Nx Monorepo** to house all applications and shared libraries. This promotes code reuse and consistent versioning.

### Structure
```
dunder-mifflin-web/
├── apps/
│   ├── portal/              # The Intranet (Shell)
│   ├── infinity/            # Sales Dashboard
│   ├── warehouse-mobile/    # Ionic/Angular for Warehouse
│   └── accounting/          # Financial Suite
├── libs/
│   ├── sabre-ui/            # Shared Design System (Dumb Components)
│   ├── auth-lib/            # OIDC & Guard Logic
│   ├── data-access/         # API Services & Interfaces
│   └── util-formatting/     # Date/Currency formatters
└── tools/                   # CI/CD scripts
```

## 4. Application Architecture (Per App)

*   **Pattern:** Smart (Container) vs. Dumb (Presentational) Components.
*   **Core Module:** Singleton services, global configuration, HTTP interceptors.
*   **Shared Module:** Reusable components, pipes, directives.
*   **Feature Modules:** Lazy-loaded routes (e.g., `OrderModule`, `ClientModule`).
*   **Standalone Components:** Preferred over NgModules for newer features.

## 5. Communication & Data Fetching

*   **HTTP Client:** Angular `HttpClient`.
*   **API Generation:** OpenAPITools (`openapi-generator-cli`) to generate TypeScript interfaces and services directly from the Backend Swagger docs.
*   **Reactive Programming:** RxJS for handling async data streams (Debouncing search, polling stock levels).

## 6. Authentication & Security

*   **Protocol:** OpenID Connect (OIDC) / OAuth 2.0 (Authorization Code Flow with PKCE).
*   **Library:** `angular-auth-oidc-client`.
*   **Implementation:**
    *   **AuthGuard:** Protects routes (e.g., `canActivate: [AuthGuard]`).
    *   **Interceptor:** Automatically attaches the `Bearer` token to outgoing API requests.
    *   **Auto-Refresh:** Handles silent token refresh in the background.

## 7. Observability (OpenTelemetry)

*   **Tracing:** `@opentelemetry/sdk-trace-web`
*   **Instrumentation:**
    *   `@opentelemetry/instrumentation-xml-http-request` (Captures API calls).
    *   `@opentelemetry/instrumentation-user-interaction` (Captures clicks/routing).
*   **Context:** Propagates `traceparent` headers to the Backend Gateway.
*   **Logging:** Centralized error handler implementing `ErrorHandler` to send stack traces to Loki.

## 8. Testing Strategy ("Testable without Backend")

The frontend must be fully testable in isolation using mocks.

### Unit Tests
*   **Tools:** Jest (Faster than Karma).
*   **Scope:** Components, Pipes, Services, NgRx Reducers/Effects.
*   **Mocking:** Use `jest.mock()` or `Spectator` to mock child components and services.

### Integration / Component Tests
*   **Tools:** Angular Testing Library (ATL).
*   **Philosophy:** Test the user interaction, not the implementation details.
*   **Network Mocking:** **Mock Service Worker (MSW)**.
    *   *Requirement:* MSW intercepts network requests at the browser level and returns fixture data (e.g., `mockClients.json`). This ensures the app works offline or without the backend running.

### End-to-End (E2E) Tests
*   **Tools:** Playwright or Cypress.
*   **Scope:** Critical User Journeys (e.g., "Jim creates a sale", "Angela approves an expense").
*   **CI:** Runs against the Mock Service Worker or a localized Docker backend.

## 9. Code Quality & Standards

*   **Linting:** ESLint + Angular ESLint Plugin.
*   **Formatting:** Prettier.
*   **Commit Hooks:** Husky (runs lint-staged before commit).
*   **Strict Mode:** `strictTemplates: true` and `strictInjectionParameters: true` in `tsconfig.json`.

## 10. Deployment (Containerization)

*   **Build:** `ng build --configuration production` (Output: static files in `dist/`).
*   **Docker:** Multi-stage build.
    *   *Stage 1:* Build the Angular app.
    *   *Stage 2:* Serve via NGINX (Alpine).
*   **NGINX Config:** Handles SPA routing (Fallbacks to `index.html` for 404s).

