# Next.js Frontend Design Document

## 1. Scope
This standard applies to Next.js applications, primarily **Dunder Mifflin Infinity** when SSR/SEO or edge rendering is required.

## 2. Technology Stack

*   **Framework:** Next.js 15+ (App Router)
*   **Language:** TypeScript (strict mode)
*   **Runtime:** Node.js 22 LTS
*   **Styling:** Tailwind CSS + Sabre design tokens/components
*   **State Management:** Server Components by default, TanStack Query only where client caching is needed

## 3. Rendering Strategy

*   Prefer Server Components for data-heavy views.
*   Use Client Components only for interactive UI requiring browser state.
*   Set route-level cache and revalidation policy explicitly.
*   Use SSR/ISR only where it materially improves UX, SEO, or freshness.

## 4. Application Structure

```
frontend/infinity-web/
├── app/                     # Routes, layouts, server components
├── app/api/                 # BFF-style route handlers if needed
├── components/              # Shared UI components
├── lib/                     # API clients, auth helpers, telemetry setup
├── tests/                   # Unit, integration, and e2e tests
└── Dockerfile               # App-owned build/runtime image definition
```

## 5. API, Auth, and Security

*   Use generated OpenAPI types for backend contracts.
*   Keep tokens server-side where possible (HTTP-only cookies).
*   Apply middleware/route guards for protected app sections.
*   Enforce CSP, security headers, and dependency vulnerability scanning.

## 6. Observability

*   Instrument server and client traces end-to-end.
*   Include correlation IDs in route handlers and outbound API calls.
*   Capture rendering and route-level latency metrics.

## 7. Testing

*   **Unit/Component:** Vitest or Jest + Testing Library.
*   **Integration:** Route handler tests with mocked upstream dependencies.
*   **E2E:** Playwright across auth, lead lifecycle, and commission workflows.

## 8. Quality Gates

*   ESLint + Prettier + `next build` + typecheck in CI.
*   Track Core Web Vitals and enforce regression thresholds.

## 9. Deployment

*   Deploy to a Node runtime or edge platform with Next.js support.
*   Use CDN caching for static assets and route-level caching for SSR/ISR output.
