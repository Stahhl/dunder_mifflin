# Infrastructure & Deployment Design Document

## 1. Overview
This document outlines the infrastructure strategy for running the entire Dunder Mifflin system locally and in production-like environments. Backend and frontend applications are owned by separate teams in separate roots/repositories, while platform orchestration composes them into an integrated environment.

## 2. Container Orchestration Strategy

*   **Tool:** Docker Compose (V2).
*   **File Structure:**
    *   `platform/docker-compose.yml`: The master integration file containing all service definitions.
    *   `platform/docker-compose.override.yml` (Optional): For local development overrides (e.g., mounting source code volumes, exposing debugging ports).

### Key Design Decisions

1.  **Single Network:** All services will reside on a custom bridge network named `dunder_net` to allow internal DNS resolution (e.g., `ping sales-service`).
2.  **Startup Order (`depends_on`):**
    *   **Level 0:** Infrastructure (Postgres, Kafka, Keycloak, OTel Collector).
    *   **Level 1:** Backend Services (Waiting for Level 0 to be healthy).
    *   **Level 2:** Frontend / Gateway (Waiting for Level 1).
3.  **Health Checks:** Every service MUST define a `healthcheck`. Dependent services will use `condition: service_healthy` to ensure a clean startup sequence, preventing "Connection Refused" loops.
4.  **Team Boundaries:** Each deployable service/app builds from its own root and its own `Dockerfile`; compose orchestrates built images rather than shared source folders.

## 3. Service Inventory

The `platform/docker-compose.yml` file will orchestrate the following:

### A. Infrastructure (The "Annex")
*   **`postgres`:** Central database (Schemas: `sales`, `inventory`, `keycloak`).
*   **`kafka` + `zookeeper`:** Message Broker.
*   **`keycloak`:** IAM Provider (Imports `realm-export.json` on startup).
*   **`openldap`:** User Directory (Seeded with `users.ldif`).
*   **`mailhog`:** SMTP Trap (Captures emails from WUPHF/Keycloak).

### B. Observability (The "Eyes")
*   **`otel-collector`:** Receives traces/metrics.
*   **`prometheus`:** Scrapes metrics from Collector.
*   **`loki`:** Log aggregation.
*   **`grafana`:** Visualizes everything (Pre-provisioned dashboards).
*   **`jaeger`:** Trace visualization.

### C. Backend Services (The "Office")
*   **`gateway`:** Spring Cloud Gateway (Port `8080`).
*   **`sales-service`:** (Internal Port).
*   **`inventory-service`:** (Internal Port).
*   **`profile-service`:** (Internal Port).
*   **Build ownership:** Each backend service image is built from `backend/<service-name>/Dockerfile`.

### D. Frontend (The "Reception")
*   **`frontend`:** NGINX serving web frontends (Angular/React/static Next.js output) on Port `80`.
*   **`warehouse-mobile`:** React Native + Expo app delivered through mobile build/release pipelines (not hosted in NGINX).
*   **Build ownership:** Each web frontend image is built from `frontend/<app-name>/Dockerfile`.

## 4. Volume Management

Persistent data will be stored in named Docker volumes to survive container restarts:
*   `postgres_data`: DB storage.
*   `kafka_data`: Message logs.
*   `prometheus_data`: Metrics history.
*   `grafana_data`: Dashboard persistence.

## 5. Environment Configuration

*   **`.env` File:** Stores shared variables (versions, ports, secrets).
    *   `POSTGRES_USER=dundermifflin`
    *   `POSTGRES_PASSWORD=bears_beets_battlestar`
    *   `KEYCLOAK_ADMIN=admin`
*   **Profiles:**
    *   `--profile app`: Runs everything.
    *   `--profile infra`: Runs only DB, Kafka, IAM (for backend dev).
    *   `--profile observability`: Runs only the OTel stack.

## 6. Usage

```bash
# Start the entire system
docker compose -f platform/docker-compose.yml --profile app up -d

# Start only infrastructure for backend development
docker compose -f platform/docker-compose.yml --profile infra up -d
```
