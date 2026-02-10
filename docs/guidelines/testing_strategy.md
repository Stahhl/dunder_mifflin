# End-to-End (E2E) Testing Strategy

## 1. Overview
This document outlines the strategy for verifying the entire Dunder Mifflin system functionality from a user's perspective. The goal is to simulate real-world scenarios ("Day in the Life") across all microservices.

## 2. Technology Stack

*   **Framework:** **Playwright** (Node.js/TypeScript).
    *   *Why?* Handles multi-tab/multi-user scenarios better than Cypress, supports API testing, and allows visual regression testing.
*   **Runner:** Docker Compose (Profile: `e2e`).
*   **Data Seeding:** Direct DB access (Postgres) or specialized "Test Seed" API endpoints available only in the `e2e` profile.

## 3. Test Environment

The E2E suite runs against a fully integrated environment, matching production as closely as possible.

*   **Services:** All backend services, frontend apps, databases, and message brokers are running.
*   **Isolation:** Each test run uses unique identifiers (e.g., `client-uuid-123`) to avoid data collisions, or the database is reset between suites.
*   **Authentication:** The test runner uses a "System Admin" user or creates temporary users via Keycloak API.

## 4. Key Test Scenarios

### A. The "Golden Ticket" Sales Flow
*   **Actors:** Jim (Sales), Darryl (Warehouse).
*   **Steps:**
    1.  **Jim logs in** to the Sales Portal.
    2.  Creates a new Lead ("Blue Cross").
    3.  Converts Lead to Client.
    4.  Places an Order for 50 reams of paper.
    5.  **Darryl logs in** to the Warehouse App.
    6.  Sees the new "Pending Shipment".
    7.  Marks the order as "Shipped".
    8.  **Jim verifies** the order status updates to "Shipped".
    9.  **System verifies** inventory count decremented by 50.

### B. The "Expense Report" Approval
*   **Actors:** Michael (Manager), Angela (Accounting).
*   **Steps:**
    1.  **Michael logs in** and submits an expense for "Core Blaster Extreme".
    2.  **Angela logs in** and sees the pending expense.
    3.  Angela rejects the expense with comment "Frivolous".
    4.  **Michael receives** a notification (via WUPHF/MailHog).

### C. The "Complaint" Workflow
*   **Actors:** Kelly (Support), Toby (HR).
*   **Steps:**
    1.  **Kelly logs in** and logs a customer complaint about "watermarks".
    2.  Escalates the ticket to HR.
    3.  **Toby logs in** and adds a note to the personnel file.

## 5. Implementation Details

### Directory Structure
```
tests/e2e/
├── config/
│   ├── playwright.config.ts
│   └── global-setup.ts       # Seeds DB, waits for health checks
├── fixtures/
│   ├── users.json            # Test user credentials
│   └── paper-products.json   # Inventory data
├── specs/
│   ├── sales-flow.spec.ts
│   ├── warehouse-flow.spec.ts
│   └── hr-flow.spec.ts
└── utils/
    ├── api-client.ts         # Helper for API calls
    └── db-client.ts          # Helper for DB verification
```

### CI/CD Integration

*   **Trigger:** On Pull Request merge to `main` or nightly.
*   **Action:**
    1.  `docker compose up -d --profile e2e`
    2.  Wait for health checks.
    3.  `npm run test:e2e`
    4.  Upload video recordings/traces of failed tests as artifacts.
