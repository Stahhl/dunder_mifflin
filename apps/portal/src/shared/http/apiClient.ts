import { createLoginUrl } from "../auth/redirect";
import { appendTraceToMessage, applyTraceHeaders } from "./trace";

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
  const headers = applyTraceHeaders(init?.headers);
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
    const message = await extractErrorMessage(response);
    throw new Error(appendTraceToMessage(message, response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function extractErrorMessage(response: Response): Promise<string> {
  const fallback = `Request failed (${response.status})`;
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return fallback;
  }

  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    const message = payload?.error?.message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  } catch {
    return fallback;
  }

  return fallback;
}
