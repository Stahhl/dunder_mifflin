# React SPA Frontend Design Document

## 1. Scope
This standard applies to React single-page applications, including the **Scranton Portal** and optionally **Dunder Mifflin Infinity** when SSR is not required.

## 2. Technology Stack

*   **Framework:** React 19+
*   **Language:** TypeScript (strict mode)
*   **Build Tool:** Vite (preferred) or Nx React plugin
*   **Routing:** React Router
*   **State Management:** TanStack Query for server state, Zustand/Redux Toolkit for complex client state
*   **Styling:** Tailwind CSS + Sabre design tokens/components

## 3. Recommended Application Structure

```
frontend/scranton-portal/
├── src/app/                 # App bootstrapping and route setup
├── src/features/            # Feature modules by domain
├── src/shared/              # Shared components/hooks/utils
├── src/api/                 # OpenAPI-generated clients and adapters
├── src/test/                # Test utilities, MSW handlers, fixtures
└── Dockerfile               # App-owned build/runtime image definition
```

## 4. Data & API Patterns

*   Use generated OpenAPI clients as the source of truth for contract typing.
*   Encapsulate API calls behind feature-level hooks (`useLeads`, `useAnnouncements`).
*   Standardize retry/backoff and stale-time policies in a shared QueryClient.

## 5. Authentication & Security

*   OIDC/OAuth2 with PKCE (browser-safe configuration only).
*   Keep tokens out of localStorage where possible; prefer secure session handling patterns.
*   Enforce protected routes and permission-aware UI states.

## 6. Observability

*   Instrument route changes, API requests, and major user interactions.
*   Propagate trace context to backend requests.
*   Report errors with release version and user/session correlation IDs.

## 7. Testing

*   **Unit/Component:** Vitest + React Testing Library.
*   **Network Mocking:** MSW.
*   **E2E:** Playwright for top business flows and role-based access verification.

## 8. Quality Gates

*   ESLint + Prettier + `tsc --noEmit`.
*   Bundle size budgets per route/chunk.
*   CI must block merges on lint/type/test failures.

## 9. Deployment

*   Build static assets and deploy behind CDN.
*   Configure SPA fallback routing and immutable hashed asset caching.
