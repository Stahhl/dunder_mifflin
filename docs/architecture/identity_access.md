# Dunder Mifflin IAM & Security Architecture

This document details the Identity and Access Management (IAM) strategy for Dunder Mifflin Scranton, replacing the generic `auth-service` with a robust, enterprise-grade solution utilizing LDAP, Keycloak, and a custom Spring Boot Gateway.

## Core Components

### 1. User Directory: LDAP (The "Rolodex")
*   **Role:** The single source of truth for user identities and organizational structure.
*   **Implementation:** OpenLDAP or Active Directory.
*   **Structure:**
    *   **Base DN:** `dc=dundermifflin,dc=com`
    *   **Organizational Units (OUs):**
        *   `ou=people`: Stores all user accounts (e.g., `uid=mscott`).
        *   `ou=groups`: Stores department groups (e.g., `cn=sales`, `cn=accounting`).
    *   **Attributes:** `uid`, `cn` (Common Name), `mail`, `memberOf`, `employeeType`.

### 2. Identity Provider (IdP): Keycloak
*   **Role:** Centralized authentication server. Handles user login, session management, and token issuance.
*   **Configuration:**
    *   **User Federation:** Connected to the LDAP directory (Read-only or Read/Write). Keycloak syncs users/groups from LDAP.
    *   **Realm:** `scranton-branch`
    *   **Client:** `dunder-mifflin-gateway` (OIDC Client).
    *   **Protocol:** OpenID Connect (OIDC) / OAuth 2.0.
    *   **Tokens:** Issues JWT (JSON Web Tokens) containing user claims (roles, groups, email).

### 3. Custom Gateway / Backend-for-Frontend (BFF)
*   **Role:** The single entry point for all client applications (Web, Mobile). It acts as a reverse proxy and security enforcement point.
*   **Implementation:** **Kotlin** application built with **Spring Boot** and **Gradle**.
*   **Tech Stack:**
    *   **Language:** Kotlin
    *   **Build Tool:** Gradle (Kotlin DSL)
    *   **Framework:** Spring Boot 3.x
    *   **Security:** Spring Security (OAuth2 Client / OIDC Login)
    *   **Routing:** Spring Cloud Gateway (Reactive) or Spring MVC Proxy.
*   **Responsibilities:**
    *   **Reverse Proxy:** Forwards authorized requests to backend microservices (Sales, Inventory, etc.).
    *   **Authentication Enforcer:** 
        *   Leverages `oauth2Login()` to handle the redirect to Keycloak.
        *   Maintains the user session via `JSESSIONID` (or `WEBSESSION` if reactive).
        *   Token Relay: Exchanges the session for the Access Token and passes it downstream in the `Authorization` header.
    *   **Token Management:** Handles the OAuth2 Authorization Code flow and Token Refresh flow automatically.

---

## Authentication Flow (Authorization Code Flow)

1.  **User Access:** Ryan (the Temp) tries to access `portal.dundermifflin.com/sales`.
2.  **Gateway Check:** The Spring Security filter chain intercepts the request.
3.  **Redirect:** If unauthenticated, Spring Security redirects Ryan's browser to Keycloak: 
    `https://idp.dundermifflin.com/auth/realms/scranton-branch/...`
4.  **Login:** Keycloak presents the login screen. Ryan enters his credentials (`rhoward` / `fire-guy-1`).
5.  **Verification:** Keycloak validates credentials against the **LDAP** directory.
6.  **Code Exchange:** Upon success, Keycloak redirects back to the Gateway (`/login/oauth2/code/keycloak`).
7.  **Token Retrieval:** Spring Boot automatically exchanges the code for an **ID Token** and **Access Token**.
8.  **Session Creation:** Gateway creates a secure session for Ryan.
9.  **Access:** Ryan is now logged in.

## Request Flow (Authenticated)

1.  **Request:** Ryan clicks "View Leads". Browser sends request to Gateway.
2.  **Validation:** Gateway validates the session.
3.  **Enrichment:** Spring Cloud Gateway (via `TokenRelay` filter) injects the Access Token (JWT) into the `Authorization: Bearer <token>` header.
4.  **Forwarding:** Gateway proxies the request to the `sales-service`.
5.  **Service Action:** `sales-service` receives the request, verifies the JWT, checks permissions, and returns data.

## Security Controls

*   **RBAC (Role-Based Access Control):**
    *   LDAP Group `cn=sales` maps to Keycloak Role `sales-associate`.
    *   Spring Security maps these Keycloak roles to `GrantedAuthority` (e.g., `ROLE_SALES_ASSOCIATE`).
*   **Scope:** Services only accept tokens with specific scopes.
*   **Auditing:** Keycloak logs all login attempts. Gateway logs all access attempts via Spring Boot Actuator/Sleuth.

---

## Technical Stack Recommendation

*   **LDAP:** `osixia/openldap` (Docker image)
*   **IdP:** `quay.io/keycloak/keycloak` (Docker image)
*   **Gateway:** Kotlin, Spring Boot 3, Gradle, Spring Security, Spring Cloud Gateway.
