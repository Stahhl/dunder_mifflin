# Dunder Mifflin Demo - System Overview

This document defines the baseline architecture used by the roadmap.

## Architecture Style

- Frontend apps call a single BFF gateway.
- Backend services are independently deployable Kotlin/Spring services.
- Cross-service workflows use CloudEvents over Kafka.
- User-facing reads are primarily REST via gateway.

## Core Services

### Gateway (`gateway`)
- Single entry point for web and mobile clients.
- Handles login redirects, session validation, token relay, and routing.
- Exposes `/api/v1/*` routes documented in `docs/contracts/rest_api_v1.md`.

### Profile Service (`profile-service`)
- User profile metadata not stored in LDAP.
- Preferences, avatars, and app-level settings.

### Sales Service (`sales-service`)
- Lead and client management.
- Publishes `com.dundermifflin.sales.lead.converted.v1` on lead conversion.

### Order Service (`order-service`)
- Order lifecycle and status timeline.
- Publishes `com.dundermifflin.order.created.v1` after order creation.

### Inventory Service (`inventory-service`)
- Stock reservation and shipment dispatch.
- Publishes reservation and shipment status events.

### Finance Service (`finance-service`)
- Expense submission and approval workflow.
- Publishes expense decision events.

### Notification Service (`wuphf-service`)
- Converts domain events into in-app notifications.
- Provides user notification stream/read state APIs.

## Primary User Flows

1. Sales lead to order:
- `sales-service` lead conversion creates a client.
- `order-service` creates order and emits order event.
- `inventory-service` reserves stock and advances shipment.

2. Warehouse dispatch:
- Warehouse app scans/loads shipment.
- `inventory-service` emits dispatch event.
- `order-service` updates timeline.

3. Expense approval:
- Manager submits expense.
- Accounting approves/rejects with reason.
- Decision event triggers submitter notification.

## Source of Truth for Contracts

- REST contracts: `docs/contracts/rest_api_v1.md`
- Event contracts: `docs/contracts/event_catalog_v1.md`
- Governance rules: `docs/guidelines/api_and_events.md`
