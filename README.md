# Dunder Mifflin API - Scrantonicity v2.0

> "Limitless paper in a paperless world."

Welcome to the **Dunder Mifflin Scranton Branch** digital infrastructure. This repository contains the complete source code for our Enterprise Resource Planning (ERP) system, modernized for the streaming era.

## 📂 Documentation

Before diving in, please review the following architectural plans:

*   **[Users & Departments](./plans/users.md):** The org chart (Who is who).
*   **[Microservices Architecture](./plans/microservices.md):** The backend services.
*   **[IAM Architecture](./plans/iam_architecture.md):** Security, LDAP, and Keycloak.
*   **[Frontend Architecture](./plans/frontend_architecture.md):** The React/Angular portals.
*   **[Observability](./plans/observability_architecture.md):** Logging and Tracing (The "Toby" of the stack).
*   **[API Strategy](./docs/design/api_strategy.md):** How we talk to each other.
*   **[E2E Testing](./docs/design/e2e_testing.md):** How we ensure quality.

## 🚀 Quick Start (The "One Command")

We use Docker Compose to spin up the entire "Office" environment.

### Prerequisites
*   Docker & Docker Compose (V2)
*   Java 21 (Temurin)
*   Node.js 20+

### Start the System
```bash
# Start everything (Backend, Frontend, Infrastructure)
docker compose --profile app up -d

# Check the logs
docker compose logs -f
```

### Access Points
| Service | URL | Credentials |
|---------|-----|-------------|
| **Portal** | http://localhost:80 | `mscott` / `password` |
| **Keycloak** | http://localhost:8080 | `admin` / `admin` |
| **Grafana** | http://localhost:3000 | `admin` / `admin` |
| **MailHog** | http://localhost:8025 | (No auth) |

## 🏗️ Project Structure

```
.
├── apps/               # Frontend Applications
│   ├── portal/         # Main Intranet
│   └── warehouse/      # Warehouse Scanner App
├── services/           # Backend Microservices
│   ├── sales/          # CRM & Sales
│   ├── inventory/      # Warehouse Management
│   └── gateway/        # Spring Cloud Gateway
├── libs/               # Shared Libraries
│   └── contracts/      # CloudEvents & DTOs
├── plans/              # Architectural Plans
├── docs/               # Detailed Design Docs
└── docker-compose.yml  # Orchestration
```

## 🧪 Testing

```bash
# Run Unit Tests (Backend)
./gradlew test

# Run E2E Tests
npm run test:e2e
```

---
*Maintained by the IT Department (Nick). Do not touch the server rack.*
