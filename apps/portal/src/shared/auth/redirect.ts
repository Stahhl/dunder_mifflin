function inferGatewayBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:8081`;
  }

  return "http://localhost:8081";
}

const gatewayBaseUrl = (import.meta.env.VITE_GATEWAY_BASE_URL?.trim() || inferGatewayBaseUrl()).replace(/\/$/, "");
const loginPath = "/oauth2/authorization/keycloak";
const logoutPath = "/logout";

function getCurrentUrlPath(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function createLoginUrl(returnTo = getCurrentUrlPath()): string {
  const encodedReturnTo = encodeURIComponent(returnTo);
  return `${gatewayBaseUrl}${loginPath}?returnTo=${encodedReturnTo}`;
}

export function createLogoutUrl(): string {
  return `${gatewayBaseUrl}${logoutPath}`;
}

export function redirectToLogin(returnTo?: string): void {
  window.location.assign(createLoginUrl(returnTo));
}

export function redirectToLogout(): void {
  window.location.assign(createLogoutUrl());
}
