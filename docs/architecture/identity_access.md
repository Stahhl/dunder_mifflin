# Dunder Mifflin Demo - Identity and Access

This document defines authentication and authorization for the demo system.

## Components

### LDAP
- Source of user and group records.
- Base DN: `dc=dundermifflin,dc=com`
- OUs:
- `ou=people`
- `ou=groups`

### Keycloak
- Realm: `scranton-branch`
- OIDC client (web BFF): `dunder-mifflin-gateway`
- OIDC client (mobile): `warehouse-mobile`
- Group sync from LDAP.

### Gateway (BFF)
- Spring Security OIDC login for browser apps.
- Maintains server-side session cookie for web clients.
- Relays access token to downstream services.

## Authentication Flows

### Web Apps (Portal, Infinity, Accounting)
1. User visits protected route.
2. Gateway redirects to Keycloak (`/oauth2/authorization/keycloak`).
3. Keycloak authenticates against LDAP.
4. Gateway receives callback and creates session.
5. Browser uses session cookie for subsequent API calls.

### Warehouse Mobile (Expo)
1. App performs OIDC Authorization Code + PKCE against Keycloak.
2. App sends bearer token to gateway/mobile routes.
3. Gateway validates token and forwards request.

## RBAC Mapping

| LDAP Group | Keycloak Role | App Access |
|---|---|---|
| `sales` | `sales-associate` | Portal + Infinity |
| `warehouse` | `warehouse-operator` | Portal + Warehouse Mobile |
| `accounting` | `accountant` | Portal + Accounting |
| `management` | `manager` | Portal + all app links |
| `admin_staff` | `portal-user` | Portal only |

### Navigation Rule
- App links are visible only when user has matching role or `manager`.

## Demo Credentials

- Default password for seeded demo users: `password`
- Test users for PR1 acceptance:
- Sales: `jhalpert` / `password`
- Warehouse: `dphilbin` / `password`
- Accounting: `amartin` / `password`

## Session and Security Defaults

- Web session idle timeout: 30 minutes.
- Session expiration behavior: redirect to login with return URL.
- Services enforce role checks with `@PreAuthorize`.
- Sensitive operations (expense decisions, shipment dispatch) require authenticated user context.
