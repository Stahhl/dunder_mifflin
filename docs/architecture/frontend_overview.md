# Dunder Mifflin Frontend Architecture

This document details the frontend applications for Dunder Mifflin Scranton. The strategy adopts a **Micro-Frontend** approach (or separate specialized SPAs) to cater to the distinct needs of Sales, Warehouse, and Corporate.

## Core Applications

### 1. The Scranton Portal (Main Intranet)
*   **Audience:** All Staff (Michael, Pam, Oscar, etc.)
*   **Tech Stack:** React, Tailwind CSS.
*   **Purpose:** The central hub. News feed, company announcements, HR forms, and links to other apps.
*   **Features:**
    *   **"The Dundies" Dashboard:** Employee recognition board.
    *   **"Threat Level Midnight" Alert System:** Corporate emergency notifications.
    *   **PPC Calendar:** Party Planning Committee events.
    *   **Conference Room Booker:** Resolves conflicts over the conference room.

### 2. Dunder Mifflin Infinity (Sales Dashboard)
*   **Audience:** Sales Staff (Jim, Dwight, Phyllis, Stanley, Andy)
*   **Tech Stack:** React (or Next.js) for SEO/Performance, Chart.js for visualizations.
*   **Purpose:** The "Ryan Howard" modernization initiative.
*   **Features:**
    *   **Lead Tracker:** Kanban board for managing leads (Glengarry leads vs. regular).
    *   **Commission Calculator:** Real-time earnings estimator.
    *   **Client Rolodex:** Digital replacement for the physical cards.
    *   **Video Chat:** Integration for remote sales calls (rarely used).

### 3. The Warehouse App (Mobile/Tablet)
*   **Audience:** Warehouse Crew (Darryl, Roy, Madge)
*   **Tech Stack:** React Native or PWA (Progressive Web App).
*   **Purpose:** Inventory management on the floor.
*   **Features:**
    *   **Scanner:** Barcode scanning for paper reams.
    *   **Shipment Loader:** Checklist for loading trucks.
    *   **Safety Counter:** "Days Since Last Accident" (resets automatically when Michael enters).
    *   **Baler Lock:** Digital safety checklist before baler operation.

### 4. Accounting & Finance Suite
*   **Audience:** Accounting (Angela, Oscar, Kevin)
*   **Tech Stack:** Angular (Strict, structured, like Angela).
*   **Purpose:** Number crunching and payroll.
*   **Features:**
    *   **Ledger View:** High-density data grids.
    *   **Expense Approval:** Denying Michael's expense reports.
    *   **Keleven Widget:** A special calculator for Kevin (Auto-corrects math errors... poorly).

### 5. WUPHF.com (Notification Center)
*   **Audience:** Everyone
*   **Tech Stack:** Web Component / Widget embedded in other apps.
*   **Purpose:** Unified notification stream.
*   **Features:**
    *   **Cross-Platform Alerts:** Pops up on Desktop, Mobile, and Fax machines.
    *   **Urgency Levels:** "Normal", "Urgent", "Michael".

---

## Shared Infrastructure

*   **Design System:** "Sabre UI" (Transitioning from legacy Dunder Mifflin styles).
    *   **Components:** Buttons, Data Grids, Modals.
    *   **Theme:** Professional Grey/Blue with splashes of "Golden Ticket" Gold.
*   **Authentication:**
    *   All apps use **OIDC/OAuth2** to redirect to the **Keycloak** login page.
    *   Session management handled by the **BFF Gateway**.

## Development Plan

1.  **Phase 1:** "The Scranton Portal" (Core shell & navigation).
2.  **Phase 2:** "Dunder Mifflin Infinity" (Sales functionality).
3.  **Phase 3:** Warehouse PWA.
4.  **Phase 4:** Accounting Suite & WUPHF integration.
