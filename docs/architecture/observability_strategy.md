# Dunder Mifflin Observability Architecture (OpenTelemetry)

This document details the observability strategy for Dunder Mifflin Scranton. We will utilize the **OpenTelemetry (OTel)** stack to achieve full visibility into our distributed system—logs, metrics, and distributed traces—from the user's click to the final database transaction.

## Core Components

### 1. Instrumentation (The "Wiretap")
*   **Frontend (Browser):**
    *   **Library:** `@opentelemetry/sdk-trace-web` & `@opentelemetry/instrumentation-document-load`.
    *   **Role:** Captures user interactions (button clicks, page loads), fetch/XHR requests, and unhandled errors.
    *   **Context:** Injects `traceparent` headers into outgoing HTTP requests to the Gateway.
    *   **Metadata:** Adds user attributes (`user.id: mscott`, `role: manager`) to spans.

*   **Gateway (Spring Boot):**
    *   **Library:** `opentelemetry-javaagent.jar` (Auto-instrumentation).
    *   **Role:** The entry point for backend traces. Connects the frontend trace ID to the backend service calls.
    *   **Spans:** Incoming HTTP request -> Auth Check -> Outgoing Proxy Request.

*   **Backend Microservices (Kotlin/Spring):**
    *   **Library:** OTel Java agent or Micrometer Tracing OTel bridge.
    *   **Role:** Traces internal logic, database queries, and message publishing.
    *   **Spans:** Controller Handler -> Service Logic -> DB Query / AMQP Publish.

*   **Message Bus (RabbitMQ):**
    *   **Library:** AMQP client instrumentation for JVM services.
    *   **Role:** Propagates context *through* the message queue.
    *   **Spans:** Producer `send` -> Consumer `process`.
    *   **Context Propagation:** Trace IDs are embedded in message headers.

*   **Database (PostgreSQL/Redis):**
    *   **Library:** Driver instrumentation (e.g., `opentelemetry-instrumentation-pg`).
    *   **Role:** Measures query performance and errors.
    *   **Spans:** `db.statement: SELECT * FROM clients WHERE name = 'Blue Cross'`.

### 2. Collection & Processing (The "Toby" of Data)
*   **OpenTelemetry Collector:**
    *   **Role:** A centralized agent (sidecar or standalone service) that receives telemetry data from all services.
    *   **Pipelines:**
        *   **Receivers:** OTLP (gRPC/HTTP).
        *   **Processors:**
            *   `batch`: Batches data for efficiency.
            *   `memory_limiter`: Prevents OOM crashes.
            *   `attributes`: Scrubs sensitive data (PII) like social security numbers or Jan's candle scents.
        *   **Exporters:** Sends processed data to backend storage (Prometheus, Jaeger, Loki).

### 3. Backend Storage & Visualization (The "Big Picture")

#### A. Tracing (The Journey)
*   **Tool:** **Jaeger** or **Tempo**.
*   **Visualization:** A Gantt chart showing the request lifecycle.
*   **Example:** User clicks "Buy Paper" -> Gateway (10ms) -> Sales Service (50ms) -> Postgres (5ms) -> RabbitMQ (2ms) -> Inventory Service (20ms).

#### B. Metrics (The Scoreboard)
*   **Tool:** **Prometheus** (Storage) + **Grafana** (Dashboards).
*   **Key Metrics:**
    *   **RED Method:** Rate (Requests/sec), Errors (500s), Duration (Latency).
    *   **Business Metrics:** "Paper Reams Sold", "Complaints Filed", "Beets Harvested".

#### C. Logs (The Paper Trail)
*   **Tool:** **Loki** (PLG Stack: Promtail + Loki + Grafana).
*   **Integration:** Logs are correlated with Traces via `trace_id`.
*   **Format:** Structured JSON logs.
*   **Example:** `{"level": "error", "msg": "Insufficient stock", "trace_id": "12345", "service": "inventory"}`.

---

## Detailed Trace Flow: "The Golden Ticket" (Order Processing)

1.  **User Action:** Michael clicks "Issue Golden Ticket" on the Portal.
    *   *Frontend:* Generates Trace ID `T1`, Span ID `S1`. Sends POST to Gateway.
2.  **Gateway:** Receives request.
    *   *Extracts:* Trace ID `T1`.
    *   *Creates:* Span ID `S2` (Child of `S1`).
    *   *Action:* Proxies to `sales-service`.
3.  **Sales Service:** Receives request.
    *   *Extracts:* Trace ID `T1`.
    *   *Creates:* Span ID `S3` (Child of `S2`).
    *   *Action:* Saves to DB (Span `S4`), Publishes `com.dundermifflin.order.created.v1` event to RabbitMQ (Span `S5`).
4.  **RabbitMQ:** Queues the message.
5.  **Inventory Service:** Consumes `com.dundermifflin.order.created.v1`.
    *   *Extracts:* Trace ID `T1` from message headers.
    *   *Creates:* Span ID `S6` (Child of `S5` - *Follows From*).
    *   *Action:* Updates stock.
6.  **WUPHF Service:** Consumes order and shipment lifecycle events.
    *   *Extracts:* Trace ID `T1`.
    *   *Creates:* Span ID `S7` (Child of `S5`).
    *   *Action:* Sends email to Corporate.

---

## Infrastructure Stack (Docker Compose)

*   `otel-collector`: The central processor.
*   `jaeger`: Distributed tracing backend.
*   `prometheus`: Metrics database.
*   `loki`: Log aggregation system.
*   `grafana`: Unified dashboard for Traces, Metrics, and Logs.

## Access Control

Observability endpoints and dashboards are operational surfaces and must be isolated from line-of-business app roles.

- Primary access role: `it-support` (mapped from LDAP group `it_support`).
- Expected login model: Keycloak SSO for Grafana and any future observability UI.
- Anonymous access must remain disabled.
- `sales-associate`, `warehouse-operator`, `accountant`, and `portal-user` should not receive observability access by default.
- If break-glass admin access is needed, use a separate elevated role (for example `platform-admin`) rather than broadening `it-support`.
