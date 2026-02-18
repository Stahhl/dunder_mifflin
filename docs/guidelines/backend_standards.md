# Backend Microservices Design Document

## 1. Overview
This document outlines the architectural standards and implementation guidelines for the Dunder Mifflin backend microservices. The goal is to build a robust, event-driven system that is easy to maintain, test, and observe.

## 2. Technology Stack

*   **Language:** Kotlin (Latest stable)
*   **JDK:** Java 21 (OpenJDK / Eclipse Temurin - **NO Oracle JDKs**)
*   **Framework:** Spring Boot 3.5+ (or latest stable 3.x)
*   **Build Tool:** Gradle (Kotlin DSL - `build.gradle.kts`)
*   **Dependency Injection:** Spring Framework Core
*   **Asynchronous Processing:** Java Virtual Threads (Project Loom) where applicable.

## 3. Architecture Pattern: Hexagonal (Ports & Adapters)

To ensure the core business logic remains isolated from infrastructure concerns (Database, RabbitMQ, HTTP), we will adopt a **Hexagonal Architecture**.

### Structure
```
src/main/kotlin/com/dundermifflin/<service-name>/
├── domain/                 # CORE: Pure Kotlin, no Spring dependencies
│   ├── model/              # Entities / Value Objects (e.g., Order, PaperType)
│   ├── port/               # Interfaces (Ports)
│   │   ├── input/          # Use Cases / Service Interfaces
│   │   └── output/         # Repository / MessagePublisher Interfaces
│   └── service/            # Implementation of Input Ports (Business Logic)
├── application/            # API Layer (Incoming Adapters)
│   ├── controller/         # REST Controllers (Spring WebMVC)
│   ├── dto/                # Data Transfer Objects (Request/Response)
│   └── exception/          # Global Exception Handling
└── infrastructure/         # Implementation Layer (Outgoing Adapters)
    ├── persistence/        # Database Entities & Repositories (Spring Data JDBC/JPA)
    ├── messaging/          # RabbitMQ publishers/consumers
    └── client/             # External API Clients (e.g., Keycloak, Third-party)
```

## 4. Communication & Messaging

*   **Pattern:** Async Event-Driven Pub/Sub.
*   **Message Broker:** RabbitMQ.
*   **Format:** CloudEvents (JSON) for standardization.
*   **Serialization:** Jackson (Kotlin Module).

### Event Standards
Event names and payloads must match `docs/contracts/event_catalog_v1.md`.
Type naming pattern:
*   `com.dundermifflin.<domain>.<action>.v<version>`

## 5. Observability (OpenTelemetry)

All services must be instrumented to provide full visibility.

*   **Tracing:** Auto-instrumentation via OTel Java Agent or Spring Cloud Sleuth (Micrometer Tracing).
*   **Metrics:** Micrometer (Prometheus registry).
*   **Logs:** SLF4J + Logback (JSON format via LogstashEncoder) with Trace ID / Span ID injection.
*   **Health Checks:** Spring Boot Actuator (`/actuator/health`, `/actuator/prometheus`).

## 6. Testing Strategy ("Testable without external dependencies")

The build must be self-contained. A developer should be able to run `./gradlew test` immediately after cloning, assuming only Docker is installed.

### Unit Tests
*   **Scope:** Domain logic, Service layer.
*   **Tools:** JUnit 5, MockK (Kotlin-native mocking).
*   **Constraint:** fast, in-memory, no I/O.

### Integration Tests
*   **Scope:** Controllers, Repositories, Messaging adapters.
*   **Tools:** **Testcontainers**.
*   **Philosophy:** Do NOT mock the database or message broker in integration tests. Spin up real, disposable instances.
*   **Implementation:**
    *   `@Testcontainers` with `PostgreSQLContainer` for DB tests.
    *   `RabbitMQContainer` for messaging tests.
    *   `KeycloakContainer` (Dasniko) for IAM tests.

### Architecture Tests
*   **Tools:** ArchUnit.
*   **Goal:** Enforce Hexagonal boundaries (e.g., "Domain layer must not depend on Infrastructure layer").

## 7. Data Storage & Management

*   **Database:** PostgreSQL.
*   **Migration:** Flyway or Liquibase.
*   **Versioning:** Migration scripts must be versioned and stored in `src/main/resources/db/migration`.
*   **ORM:** Spring Data JPA (Hibernate) or Spring Data JDBC (for simpler read models).

## 8. Security

*   **Authentication:** OAuth2 / OIDC via Keycloak.
*   **Authorization:** Method-level security using mapped roles (e.g., `@PreAuthorize("hasRole('SALES_ASSOCIATE')")`).
*   **Secrets:** Never commit secrets. Use Environment Variables or Spring Cloud Config.

## 9. API Specifications

*   **Style:** REST (Level 2/3).
*   **Documentation:** OpenAPI 3.0 (Swagger) generated code-first via `springdoc-openapi`.
*   **Contract alignment:** Endpoints and payloads must align with `docs/contracts/rest_api_v1.md`.
*   **Endpoint:** `/v3/api-docs` and `/swagger-ui.html`.

## 10. Build Configuration (Gradle)

*   **Plugins:**
    *   `org.springframework.boot`
    *   `io.spring.dependency-management`
    *   `org.jetbrains.kotlin.jvm`
    *   `org.jetbrains.kotlin.plugin.spring`
    *   `org.jetbrains.kotlin.plugin.jpa`
*   **Quality Gates:**
    *   **Ktlint:** For code style enforcement.
    *   **Detekt:** For static code analysis.
    *   **Jacoco:** For code coverage (Target: >80%).
