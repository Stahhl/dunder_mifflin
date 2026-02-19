const gatewayBaseUrl = (import.meta.env.VITE_GATEWAY_BASE_URL ?? "").replace(/\/$/, "");
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
