import { createLoginUrl } from "../auth/redirect";

const gatewayBaseUrl = (import.meta.env.VITE_GATEWAY_BASE_URL ?? "").replace(/\/$/, "");

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
