import { createLoginUrl } from "../auth/redirect";

function inferGatewayBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:8081`;
  }

  return "http://localhost:8081";
}

const gatewayBaseUrl = (import.meta.env.VITE_GATEWAY_BASE_URL?.trim() || inferGatewayBaseUrl()).replace(/\/$/, "");

export class UnauthenticatedError extends Error {
  constructor(message = "Session expired") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

export async function apiClient<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const response = await fetch(`${gatewayBaseUrl}${path}`, {
    ...init,
    headers,
    credentials: "include"
  });

  if (response.status === 401) {
    window.location.assign(createLoginUrl());
    throw new UnauthenticatedError();
  }

  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
