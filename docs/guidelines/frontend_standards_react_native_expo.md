# React Native (Expo) Design Document

## 1. Scope
This standard applies to the **Warehouse App (Mobile/Tablet)**. The warehouse application stack is explicitly **React Native with Expo**.

## 2. Technology Stack

*   **Framework:** React Native (latest stable) + Expo SDK (latest stable)
*   **Language:** TypeScript (strict mode)
*   **Navigation:** React Navigation
*   **State Management:** TanStack Query + lightweight client state (Zustand or Context)
*   **UI:** Shared Sabre tokens adapted for native components
*   **Build/Release:** EAS Build, EAS Submit, EAS Update

## 3. Device Capabilities

*   Barcode/QR scanning via Expo camera/scanner modules.
*   Offline-first workflows for warehouse floor operations.
*   Background-safe sync behavior with explicit retry and conflict handling.
*   Push notifications for shipment and safety alerts when required.

## 4. Project Structure

```
frontend/warehouse-mobile/
├── app/                     # Expo Router screens and layouts (or src/screens)
├── src/features/            # Inventory, shipments, safety workflows
├── src/api/                 # Generated clients, adapters, sync logic
├── src/storage/             # Offline cache and persistence
├── src/test/                # Test helpers and fixtures
└── Dockerfile.ci            # App-owned CI/containerized build tooling
```

## 5. Data, Sync, and Resilience

*   Queue write operations while offline and replay safely when back online.
*   Use idempotency keys for mutation retries.
*   Show clear sync status in UI to prevent duplicate warehouse actions.

## 6. Authentication & Security

*   Use OIDC/OAuth2 PKCE flow suitable for mobile apps.
*   Store sensitive credentials in secure device storage.
*   Enforce session expiry and logout on token invalidation.

## 7. Testing

*   **Unit/Component:** Jest + React Native Testing Library.
*   **Integration:** Mocked API tests around offline/online transitions.
*   **E2E:** Detox or Maestro for scanner flow, shipment checklist, and login.

## 8. Quality Gates

*   ESLint + Prettier + TypeScript checks in CI.
*   Validate iOS/Android build health via EAS build jobs on release branches.

## 9. Deployment & Operations

*   Distribute internal builds via EAS for warehouse UAT.
*   Release production binaries through App Store / managed device channels.
*   Use EAS Update for non-native urgent fixes, with rollout controls.
