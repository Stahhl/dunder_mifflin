# Web Components Design Document

## 1. Scope
This standard applies to embeddable frontend widgets, including **WUPHF Notification Center**.

## 2. Technology Stack

*   **Component Model:** Standards-based Web Components (Custom Elements + Shadow DOM)
*   **Language:** TypeScript
*   **Library:** Lit (preferred) or vanilla custom elements for minimal runtime
*   **Build Tool:** Vite/Rollup with output targeting modern evergreen browsers

## 3. Compatibility & Embedding Rules

*   Widgets must run inside Angular, React, Next.js, and plain HTML hosts.
*   Expose a stable custom element API (attributes/events/methods) with semantic versioning.
*   Avoid global CSS leakage by defaulting to Shadow DOM encapsulation.
*   Provide framework wrappers only as thin optional adapters.

## 4. Data & Communication

*   Accept host-provided auth/session context through explicit props/events, not global assumptions.
*   Support event-based messaging for host integration (`notification-clicked`, `notification-read`).
*   Keep API calls inside a versioned client layer; do not bind directly from UI primitives.

## 5. Security

*   Sanitize any rendered rich text.
*   Enforce strict CSP compatibility (no inline script requirements).
*   Do not access host DOM beyond documented integration hooks.

## 6. Observability

*   Emit structured diagnostics hooks for host logging systems.
*   Propagate trace context where host passes correlation metadata.
*   Track render failures and API failures with component version tags.

## 7. Testing

*   **Unit/Component:** Web Test Runner or Vitest + DOM testing.
*   **Contract Tests:** Verify custom element API compatibility.
*   **Integration:** Host-matrix tests against React, Angular, and plain HTML sample hosts.

## 8. Quality Gates

*   Enforce bundle size budget for embeddable scripts.
*   Validate no breaking API changes without major version bump.
*   Lint, format, and typecheck are required for merge.

## 9. Distribution

*   Publish versioned bundles to a CDN.
*   Maintain backward compatibility within major versions.
*   Provide copy-paste integration snippets and changelog for host teams.
*   Keep the widget in its own root (`frontend/wuphf-widget/`) with an app-owned `Dockerfile` for reproducible build and publish pipelines.
