export interface AuthMeResponse {
  userId: string;
  displayName: string;
  roles: string[];
  groups: string[];
  apps: string[];
  sessionExpiresAt: string;
}

export interface OrderSummary {
  orderId: string;
  clientId: string;
  status: string;
  requestedShipDate: string;
  createdAt: string;
}

export interface OrderTimelineEvent {
  status: string;
  at: string;
  source: string;
}

export interface OrderTimelineResponse {
  orderId: string;
  events: OrderTimelineEvent[];
}

export interface CreateOrderRequest {
  clientId: string;
  requestedShipDate: string;
  items: Array<{ sku: string; quantity: number }>;
  notes?: string;
}

export interface CreateOrderResponse {
  orderId: string;
  status: string;
  createdAt: string;
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
  const response = await fetch(buildGatewayUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      accept: "application/json",
      ...(init.headers ?? {})
    }
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    throw new Error(errorMessage(payload, fallbackError));
  }

  return payload as T;
}

export async function fetchAuthMe(): Promise<AuthMeResponse | null> {
  const response = await fetch(buildGatewayUrl("/api/v1/auth/me"), {
    method: "GET",
    credentials: "include",
    headers: {
      accept: "application/json"
    }
  });

  if (response.status === 401) {
    return null;
  }

  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(payload, "Unable to load session profile"));
  }

  return payload as AuthMeResponse;
}

export async function createOrder(payload: CreateOrderRequest): Promise<CreateOrderResponse> {
  return requestJson<CreateOrderResponse>(
    "/api/v1/orders",
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    },
    "Order submission failed"
  );
}

export async function listOrders(clientId?: string): Promise<{ items: OrderSummary[]; total: number }> {
  const search = clientId && clientId.trim().length > 0 ? `?clientId=${encodeURIComponent(clientId.trim())}` : "";
  return requestJson<{ items: OrderSummary[]; total: number }>(
    `/api/v1/orders${search}`,
    { method: "GET" },
    "Unable to load order history"
  );
}

export async function fetchTimeline(orderId: string): Promise<OrderTimelineResponse> {
  return requestJson<OrderTimelineResponse>(
    `/api/v1/orders/${encodeURIComponent(orderId)}/timeline`,
    { method: "GET" },
    "Unable to load order timeline"
  );
}

export function openTimelineStream(orderId: string): EventSource {
  return new EventSource(buildGatewayUrl(`/api/v1/orders/${encodeURIComponent(orderId)}/timeline/stream`), {
    withCredentials: true
  });
}
