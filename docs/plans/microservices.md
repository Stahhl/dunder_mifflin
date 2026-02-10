# Dunder Mifflin Microservices Architecture

This document outlines the backend microservices architecture for Dunder Mifflin. The system follows an **Event-Driven Architecture (EDA)** pattern, utilizing asynchronous communication via a Pub/Sub mechanism (e.g., Kafka, RabbitMQ, or NATS).

**Note:** Identity and Access Management (IAM) is handled separately via the [IAM Architecture](./iam_architecture.md).

## Architecture Overview

*   **Communication Style:** Asynchronous, Event-Driven.
*   **Pattern:** Publisher/Subscriber. Services publish events to topics; interested services subscribe and react.
*   **Goal:** Decouple departments (Sales, Warehouse, Accounting) to prevent bottlenecks (like when Michael distracts everyone).

---

## Core Microservices

### 1. User Profile Service (`profile-service`)
*   **Responsibility:** Stores user data *not* contained in LDAP/Keycloak (e.g., "World's Best Boss" mug preferences, emergency contact, birthday for PPC).
*   **Key Data:** User Settings, Avatars, Fun Run stats.
*   **Events Published:** `profile.updated`.
*   **Note:** Replaces the legacy `auth-service`. Authentication is now offloaded to Keycloak.

### 2. CRM & Sales Service (`sales-service`)
*   **Responsibility:** Manages client data ("The Rolodex"), leads, and sales quotas.
*   **Key Data:** Clients (Blue Cross, Lackawanna County), Sales Targets, Commission Logs.
*   **Events Published:** `client.added`, `lead.converted`.

### 3. Order Management Service (`order-service`)
*   **Responsibility:** The core engine. Processes paper orders from sales staff.
*   **Key Data:** Orders, Order Status, Pricing Rules (Golden Ticket promotions).
*   **Events Published:**
    *   `order.created`: Triggered when Jim/Dwight closes a sale.
    *   `order.cancelled`: Triggered if a client backs out.

### 4. Warehouse & Inventory Service (`inventory-service`)
*   **Responsibility:** Tracks physical stock levels, manages shipments, and coordinates with the loading dock.
*   **Key Data:** SKU counts, Shelf locations, Baler safety status.
*   **Events Published:**
    *   `stock.reserved`: Response to `order.created`.
    *   `shipment.dispatched`: When Darryl loads the truck.
    *   `stock.low`: Triggers re-supply alerts.

### 5. Accounting & Billing Service (`finance-service`)
*   **Responsibility:** Invoicing, payroll, expense reports, and "Keleven" error correction.
*   **Key Data:** Invoices, Ledgers, Payroll records.
*   **Events Published:**
    *   `invoice.generated`: Sent after order confirmation.
    *   `payment.received`: Updates order status.

### 6. HR & Compliance Service (`hr-service`)
*   **Responsibility:** Employee records, conflict resolution logs, and corporate policy enforcement.
*   **Key Data:** Personnel files, Complaint forms (mostly against Michael).
*   **Events Published:** `employee.hired`, `complaint.filed`.

### 7. Customer Support Service (`support-service`)
*   **Responsibility:** Managing customer complaints and quality assurance inquiries.
*   **Key Data:** Support Tickets, Call logs.
*   **Events Published:** `ticket.created`, `ticket.resolved`.

---

## Event Flow Examples

### Scenario A: The "Big Sale" (Jim closes a deal)
1.  **Sales Service**: Jim submits a new sale.
    *   *Publishes:* `order.created` (Payload: ClientID, Items, Qty)
2.  **Inventory Service**: Subscribes to `order.created`. Checks stock.
    *   *Action:* Reserves paper reams.
    *   *Publishes:* `stock.reserved` or `stock.insufficient`.
3.  **Order Service**: Subscribes to `stock.reserved`.
    *   *Action:* Confirms order status to "Processing".
4.  **Finance Service**: Subscribes to `stock.reserved`.
    *   *Action:* Generates an invoice for the client.
    *   *Publishes:* `invoice.sent`.
5.  **Warehouse Service**: Subscribes to `stock.reserved`.
    *   *Action:* Generates a pick-list for Darryl/Roy.

### Scenario B: The "Quality Assurance" Check (Creed does his job?)
1.  **Support Service**: Kelly receives a call about a watermark of a cartoon duck on the paper.
    *   *Publishes:* `ticket.created` (Severity: High).
2.  **Quality Service**: Subscribes to `ticket.created`.
    *   *Action:* Flags the production batch.
    *   *Publishes:* `batch.quarantine`.
3.  **Inventory Service**: Subscribes to `batch.quarantine`.
    *   *Action:* Locks stock associated with that batch so it can't ship.
4.  **Management Service**: Subscribes to `batch.quarantine`.
    *   *Action:* Alerts Michael (who initiates "Threat Level Midnight" protocols).

### Scenario C: WUPHF integration (Notification Relay)
*   **Notification Service**: Listens to ALL critical topics (`order.created`, `ticket.created`, `stock.low`).
    *   *Action:* Sends alerts via Email, SMS, Fax, and Facebook simultaneously.
