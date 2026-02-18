# Dunder Mifflin API - Scrantonicity v2.0

> "Limitless paper in a paperless world."

Welcome to the **Dunder Mifflin Scranton Branch** digital infrastructure. The platform is intentionally split into separate backend and frontend roots so different teams can build, test, and release independently.

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

We use Docker Compose to spin up an integrated "Office" environment from independently built backend/frontend images.

### Prerequisites
*   Docker & Docker Compose (V2)
*   Java 21 (Temurin)
*   Node.js 20+

### Start the System
```bash
# Start everything (Backend, Frontend, Infrastructure)
docker compose -f platform/docker-compose.yml --profile app up -d

# Check the logs
docker compose -f platform/docker-compose.yml logs -f
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
├── backend/                    # Backend service roots (team-owned)
│   ├── sales-service/
│   │   ├── src/
│   │   └── Dockerfile
│   ├── inventory-service/
│   │   ├── src/
│   │   └── Dockerfile
│   └── gateway/
│       ├── src/
│       └── Dockerfile
├── frontend/                   # Frontend app roots (team-owned)
│   ├── scranton-portal/
│   │   ├── src/
│   │   └── Dockerfile
│   ├── infinity-web/
│   │   ├── src/
│   │   └── Dockerfile
│   └── warehouse-mobile/
│       ├── app/
│       └── Dockerfile.ci
├── contracts/                  # Versioned OpenAPI/AsyncAPI/JSON Schemas
├── platform/                   # Integration/orchestration assets
│   └── docker-compose.yml
├── plans/                      # Architectural Plans
└── docs/                       # Detailed Design Docs
```

## 🧪 Testing

```bash
# Run Unit Tests (Backend example)
cd backend/sales-service && ./gradlew test

# Run E2E Tests (integration workspace)
cd platform && npm run test:e2e
```

---
*Maintained by the IT Department (Nick). Do not touch the server rack.*
