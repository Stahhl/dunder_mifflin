import type { RuntimeConfig } from "../types/warehouse";

export const E2E_MOCK_SCANNER = process.env.EXPO_PUBLIC_E2E_MOCK_SCANNER !== "false";

export function getRuntimeConfig(): RuntimeConfig {
  if (typeof window === "undefined") {
    return {
      gatewayBaseUrl: process.env.EXPO_PUBLIC_GATEWAY_BASE_URL ?? "http://localhost:8081",
      keycloakBaseUrl: process.env.EXPO_PUBLIC_KEYCLOAK_BASE_URL ?? "http://localhost:8080",
      realm: process.env.EXPO_PUBLIC_KEYCLOAK_REALM ?? "scranton-branch",
      clientId: process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID ?? "warehouse-mobile"
    };
  }

  const hostname = window.location.hostname || "localhost";

  return {
    gatewayBaseUrl: process.env.EXPO_PUBLIC_GATEWAY_BASE_URL ?? `http://${hostname}:8081`,
    keycloakBaseUrl: process.env.EXPO_PUBLIC_KEYCLOAK_BASE_URL ?? `http://${hostname}:8080`,
    realm: process.env.EXPO_PUBLIC_KEYCLOAK_REALM ?? "scranton-branch",
    clientId: process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID ?? "warehouse-mobile"
  };
}
