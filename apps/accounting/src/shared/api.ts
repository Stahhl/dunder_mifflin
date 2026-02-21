import { appendTraceToMessage, applyTraceHeaders } from "./trace";

export interface AuthMeResponse {
  userId: string;
  displayName: string;
  roles: string[];
  groups: string[];
  apps: string[];
  sessionExpiresAt: string;
}

export type ExpenseStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface Expense {
  expenseId: string;
  submitterUserId: string;
  category: string;
  amount: number;
  currency: string;
  description: string;
  receiptUrl?: string | null;
  status: ExpenseStatus;
  createdAt: string;
  decidedBy?: string | null;
  decidedAt?: string | null;
  decisionComment?: string | null;
}

export interface CreateExpenseRequest {
  submitterUserId?: string;
  category: string;
  amount: number;
  currency: string;
  description: string;
  receiptUrl?: string;
}

export interface ExpenseDecisionRequest {
  decision: "APPROVED" | "REJECTED";
  comment: string;
}

function inferGatewayBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:8081`;
  }

  return "http://localhost:8081";
}

export const gatewayBaseUrl = (import.meta.env.VITE_GATEWAY_BASE_URL?.trim() || inferGatewayBaseUrl()).replace(
  /\/$/,
  ""
);

export function buildGatewayUrl(path: string): string {
  return `${gatewayBaseUrl}${path}`;
}

export function buildGatewayLoginUrl(returnTo: string): string {
  const query = new URLSearchParams({ returnTo }).toString();
  return `${buildGatewayUrl("/oauth2/authorization/keycloak")}?${query}`;
}

async function parseJson(response: Response): Promise<unknown> {
  const bodyText = await response.text();
  if (!bodyText) {
    return null;
  }

  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    return { error: { message: bodyText } };
  }
}

function errorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const value = (payload as { error?: { message?: string } }).error?.message;
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return fallback;
}

async function requestJson<T>(path: string, init: RequestInit, fallbackError: string): Promise<T> {
  const headers = applyTraceHeaders({
    accept: "application/json",
    ...(init.headers ?? {})
  });

  const response = await fetch(buildGatewayUrl(path), {
    ...init,
    credentials: "include",
    headers
  });

  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(appendTraceToMessage(errorMessage(payload, fallbackError), response));
  }

  return payload as T;
}

export async function fetchAuthMe(): Promise<AuthMeResponse | null> {
  const headers = applyTraceHeaders({
    accept: "application/json"
  });

  const response = await fetch(buildGatewayUrl("/api/v1/auth/me"), {
    method: "GET",
    credentials: "include",
    headers
  });

  if (response.status === 401) {
    return null;
  }

  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(appendTraceToMessage(errorMessage(payload, "Unable to load session profile"), response));
  }

  return payload as AuthMeResponse;
}

export async function listExpenses(status?: ExpenseStatus | "ALL"): Promise<{ items: Expense[]; total: number }> {
  const query = status && status !== "ALL" ? `?status=${encodeURIComponent(status)}` : "";
  return requestJson<{ items: Expense[]; total: number }>(
    `/api/v1/expenses${query}`,
    { method: "GET" },
    "Unable to load expenses"
  );
}

export async function createExpense(payload: CreateExpenseRequest): Promise<Expense> {
  return requestJson<Expense>(
    "/api/v1/expenses",
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    },
    "Unable to create expense"
  );
}

export async function decideExpense(expenseId: string, payload: ExpenseDecisionRequest): Promise<Expense> {
  return requestJson<Expense>(
    `/api/v1/expenses/${encodeURIComponent(expenseId)}/decision`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    },
    "Unable to submit expense decision"
  );
}
