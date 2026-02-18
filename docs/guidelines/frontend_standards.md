# Frontend Standards (Cross-Stack)

## 1. Overview
This document defines the shared standards for all Dunder Mifflin frontend applications. Because we use multiple frontend stacks, stack-specific requirements live in dedicated design documents linked below.

## 2. Application-to-Stack Mapping

*   **Scranton Portal (Main Intranet):** React SPA
*   **Dunder Mifflin Infinity (Sales Dashboard):** React SPA or Next.js (based on SEO/SSR requirements)
*   **Warehouse App (Mobile/Tablet):** React Native with Expo
*   **Accounting & Finance Suite:** Angular
*   **WUPHF Notification Center:** Web Components / embeddable widget

## 3. Stack-Specific Design Documents

*   **Angular Standards:** `docs/guidelines/frontend_standards_angular.md`
*   **React SPA Standards:** `docs/guidelines/frontend_standards_react_spa.md`
*   **Next.js Standards:** `docs/guidelines/frontend_standards_nextjs.md`
*   **React Native + Expo Standards:** `docs/guidelines/frontend_standards_react_native_expo.md`
*   **Web Components Standards:** `docs/guidelines/frontend_standards_web_components.md`

## 4. Non-Negotiable Shared Requirements

*   **Language:** TypeScript in strict mode for all JavaScript/TypeScript stacks.
*   **API Contracts:** Generate and consume typed API clients from OpenAPI specs.
*   **Authentication:** OIDC/OAuth2 Authorization Code with PKCE. No implicit flow.
*   **Authorization:** UI route- and feature-level guards must align with backend roles/scopes.
*   **Accessibility:** WCAG 2.1 AA baseline for all user-facing web and mobile screens.
*   **Observability:** OpenTelemetry trace propagation and centralized frontend error reporting.
*   **Testing:** Each app must run unit/component tests in CI and have E2E coverage for critical workflows.
*   **Security:** No secrets in source control, enforce CSP for web apps, and secure token storage patterns per platform.
*   **Quality Gates:** ESLint + Prettier + typecheck must pass before merge.

## 5. Repository Boundary Strategy

Frontend and backend codebases must remain in separate root directories to simulate independent team ownership and release cadence.

*   **Frontend roots:** `frontend/<app-name>/` (one root per deployable app/widget).
*   **Backend roots:** `backend/<service-name>/` (one root per microservice).
*   **Ownership:** Each root has its own dependency manifest, lockfile, CI workflow, and release process.
*   **Code sharing rule:** Do not import backend source code into frontend projects or vice versa.
*   **Shared assets:** Share only through versioned artifacts (OpenAPI specs, AsyncAPI/JSON schemas, design tokens packages), never through cross-root source imports.
*   **Containerization:** Every deployable web frontend must include its own `Dockerfile`; mobile apps must include their own build root and CI container configuration (`Dockerfile.ci` or equivalent).

## 6. Deployment Model

*   **React SPA / Angular / Next.js static output:** Build in each app root and publish image/artifacts from that app's own `Dockerfile`.
*   **Next.js SSR routes:** Deploy on a Node runtime with caching configured per route.
*   **React Native (Expo):** Ship via EAS Build/Submit; use EAS Update for OTA JavaScript updates.
*   **Embeddable Widgets:** Versioned bundles hosted on CDN with strict backward compatibility policy.
