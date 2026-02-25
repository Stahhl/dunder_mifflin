# Dunder Mifflin System Interaction Diagrams

This document provides a visual map of user roles, app/service communication, auth integration, observability flow, and BI boundary patterns.

## 1. User Roles -> App Access

```mermaid
flowchart LR
  subgraph Roles["User Roles"]
    sales["Sales Associate"]
    warehouse["Warehouse Operator"]
    accounting["Accountant"]
    manager["Manager"]
    portalUser["Portal User"]
    itSupport["IT Support"]
  end

  subgraph Apps["Apps and Operational Surfaces"]
    portal["Portal App\n(React)"]
    infinity["Infinity App\n(React)"]
    mobile["Warehouse Mobile\n(Expo)"]
    acct["Accounting App\n(Angular)"]
    grafana["Grafana\n(Observability)"]
  end

  sales --> portal
  sales --> infinity

  warehouse --> portal
  warehouse --> mobile

  accounting --> portal
  accounting --> acct

  manager --> portal
  manager --> infinity
  manager --> mobile
  manager --> acct

  portalUser --> portal

  itSupport --> grafana
```

## 2. App -> Gateway -> Services (Synchronous Path)

```mermaid
flowchart LR
  subgraph Frontends["Frontend Apps"]
    portal["Portal"]
    infinity["Infinity"]
    mobile["Warehouse Mobile"]
    acct["Accounting"]
    widget["WUPHF Widget\n(Embedded)"]
  end

  gateway["Gateway BFF\n(Spring Boot)"]

  portal --> gateway
  infinity --> gateway
  mobile --> gateway
  acct --> gateway
  widget --> gateway

  subgraph DomainServices["Domain Services"]
    profile["profile-service"]
    sales["sales-service"]
    order["order-service"]
    inventory["inventory-service"]
    finance["finance-service"]
    wuphf["wuphf-service"]
  end

  gateway --> profile
  gateway --> sales
  gateway --> order
  gateway --> inventory
  gateway --> finance
  gateway --> wuphf
```

## 3. Service-to-Service Communication (Asynchronous/Event-Driven)

```mermaid
flowchart LR
  rabbit["RabbitMQ Exchange\n(dm.domain.events)"]

  sales["sales-service"] -- "sales.lead.converted.v1" --> rabbit
  order["order-service"] -- "order.created.v1" --> rabbit
  inventory["inventory-service"] -- "shipment.dispatched.v1" --> rabbit
  finance["finance-service"] -- "finance.expense.submitted.v1\nfinance.expense.decided.v1" --> rabbit

  rabbit -- "order.created.v1" --> inventory
  rabbit -- "inventory.stock.*.v1\nshipment.dispatched.v1" --> order
  rabbit -- "order.*.v1\nshipment.*.v1\nfinance.expense.*.v1" --> wuphf["wuphf-service"]
  rabbit -- "order.created.v1\nshipment.dispatched.v1\nfinance.expense.decided.v1" --> bi["bi-ingestion-service"]
```

## 4. Authentication and Authorization Integration

```mermaid
sequenceDiagram
  autonumber
  actor User as User (Browser/Mobile)
  participant App as App UI
  participant Gateway as Gateway (BFF)
  participant Keycloak as Keycloak
  participant LDAP as LDAP
  participant Service as Domain Service

  alt Web App (Portal/Infinity/Accounting)
    User->>App: Open protected route
    App->>Gateway: Request page or API
    Gateway->>Keycloak: OIDC redirect
    Keycloak->>LDAP: Authenticate user and resolve groups
    LDAP-->>Keycloak: User + group data
    Keycloak-->>Gateway: Auth code / tokens
    Gateway-->>App: Session cookie + app payload
    App->>Gateway: API requests with session cookie
  else Warehouse Mobile (Expo)
    User->>App: Tap sign in
    App->>Keycloak: OIDC authorization code + PKCE
    Keycloak->>LDAP: Authenticate user and resolve groups
    LDAP-->>Keycloak: User + group data
    Keycloak-->>App: Access token
    App->>Gateway: API requests with bearer token
  end

  Gateway->>Service: Forward user identity and role context
  Service-->>Gateway: Enforced response
  Gateway-->>App: Result
```

## 5. Observability Integration

```mermaid
flowchart LR
  apps["User Apps\n(traceparent + X-Trace-Id + X-Request-Id)"] --> gateway["gateway"]
  gateway --> profile["profile-service"]
  gateway --> sales["sales-service"]
  gateway --> order["order-service"]
  gateway --> inventory["inventory-service"]
  gateway --> finance["finance-service"]
  gateway --> wuphf["wuphf-service"]

  order --> rabbit["RabbitMQ\n(trace context in message headers)"]
  inventory --> rabbit
  finance --> rabbit
  rabbit --> order
  rabbit --> inventory
  rabbit --> wuphf
  rabbit --> bi["bi-ingestion-service"]

  prometheus["Prometheus"] --> gateway
  prometheus --> profile
  prometheus --> sales
  prometheus --> order
  prometheus --> inventory
  prometheus --> finance
  prometheus --> wuphf

  grafana["Grafana"] --> prometheus
  keycloak["Keycloak SSO"] --> grafana
  itsupport["it-support role"] --> grafana
```

## 6. Data Ownership and BI Decoupling Boundary

```mermaid
flowchart LR
  subgraph Transactional["Transactional Service Boundary"]
    gw["gateway"]
    profile["profile-service\n(owns profile schema)"]
    sales["sales-service\n(owns sales schema)"]
    order["order-service\n(owns order schema)"]
    inventory["inventory-service\n(owns inventory schema)"]
    finance["finance-service\n(owns finance schema)"]
    wuphf["wuphf-service\n(owns notification schema)"]
    dbs["Service-owned PostgreSQL schemas"]
  end

  order --> rabbit["RabbitMQ Events"]
  inventory --> rabbit
  finance --> rabbit
  sales --> rabbit
  wuphf --> rabbit

  subgraph Analytics["Analytics Boundary"]
    bi["bi-ingestion-service"]
    minio["MinIO\n(raw immutable events)"]
    clickhouse["ClickHouse\n(curated facts)"]
    metabase["Metabase\n(analyst BI UI)"]
  end

  rabbit --> bi
  bi --> minio
  bi --> clickhouse
  metabase --> clickhouse

  analysts["BI Analysts"] --> metabase
  analysts -. "no direct access" .-> dbs
```

## 7. End-to-End Order-to-Dispatch-to-Notification Flow

```mermaid
sequenceDiagram
  autonumber
  actor SalesUser as Sales User
  participant Infinity as Infinity App
  participant Gateway as Gateway
  participant Order as order-service
  participant Rabbit as RabbitMQ
  participant Inventory as inventory-service
  participant WUPHF as wuphf-service
  participant Widget as WUPHF Widget

  SalesUser->>Infinity: Place order
  Infinity->>Gateway: POST /api/v1/orders
  Gateway->>Order: Forward order create request
  Order-->>Gateway: Order created
  Gateway-->>Infinity: Order response
  Order->>Rabbit: Publish order.created.v1
  Rabbit->>Inventory: Deliver order.created.v1
  Inventory->>Rabbit: Publish shipment.dispatched.v1
  Rabbit->>Order: Deliver shipment.dispatched.v1
  Rabbit->>WUPHF: Deliver order/shipment events
  WUPHF-->>Gateway: Notification query API serves updates
  Gateway-->>Widget: Notification payloads
  Widget-->>SalesUser: Order + shipment notifications
```
