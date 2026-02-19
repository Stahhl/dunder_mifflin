# Dunder Mifflin Demo - Frontend Overview

This document defines the frontend app lineup used by the roadmap.

## App Portfolio

### Scranton Portal (`apps/portal`)
- Audience: all authenticated users.
- Stack: React + TypeScript + Vite.
- Purpose: app launcher, role-aware navigation, shared notifications entry point.

### Infinity (`apps/infinity`)
- Audience: Sales and Management.
- Stack: React + TypeScript + Vite.
- Purpose: leads board, lead conversion, order placement, order timeline.

### Warehouse Mobile (`apps/warehouse-mobile`)
- Audience: Warehouse and Management.
- Stack: Expo (React Native + TypeScript).
- Purpose: scanning, pick list, dispatch, offline mutation queue.

### Accounting Suite (`apps/accounting`)
- Audience: Accounting and Management.
- Stack: Angular 18+ + TypeScript strict mode.
- Purpose: expense queue, detail review, approve/reject workflow.

### WUPHF Widget (`apps/wuphf-widget`)
- Audience: embedded in portal/infinity/accounting.
- Stack: Web Components (Lit or vanilla custom elements).
- Purpose: unified notification center.

## Shared Frontend Contracts

- All apps consume gateway APIs from `docs/contracts/rest_api_v1.md`.
- Event-driven UX updates map to statuses defined in `docs/contracts/event_catalog_v1.md`.
- Role-to-nav behavior follows `docs/architecture/identity_access.md`.

## Cross-App UX Rules

- Authentication must always route through Keycloak.
- Unauthorized routes must redirect to login.
- Error states must be actionable (no silent blank screens).
- Trace context headers must be propagated on all API calls.
