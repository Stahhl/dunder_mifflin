import { appendTraceToMessage, applyTraceHeaders } from "./trace";

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

export type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "DISQUALIFIED" | "CONVERTED";

export interface LeadSummary {
  leadId: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  status: LeadStatus;
  createdAt: string;
  convertedClientId?: string | null;
}

export interface LeadDetail extends LeadSummary {
  phone: string;
  notes: string;
  createdBy: string;
  updatedAt: string;
  convertedAt?: string | null;
}

export interface CreateLeadRequest {
  companyName: string;
  contactName: string;
  contactEmail: string;
  phone: string;
  notes?: string;
}

export interface UpdateLeadRequest {
  status: LeadStatus;
  notes?: string;
}

export interface LeadConversionResponse {
  leadId: string;
  clientId: string;
  convertedAt: string;
  alreadyConverted: boolean;
}

export interface ClientSummary {
  clientId: string;
  sourceLeadId: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
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

export async function createLead(payload: CreateLeadRequest): Promise<LeadDetail> {
  return requestJson<LeadDetail>(
    "/api/v1/sales/leads",
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    },
    "Lead creation failed"
  );
}

export async function listLeads(status?: LeadStatus): Promise<{ items: LeadSummary[]; total: number }> {
  const search = status ? `?status=${encodeURIComponent(status)}` : "";
  return requestJson<{ items: LeadSummary[]; total: number }>(
    `/api/v1/sales/leads${search}`,
    { method: "GET" },
    "Unable to load leads"
  );
}

export async function updateLead(leadId: string, payload: UpdateLeadRequest): Promise<LeadDetail> {
  return requestJson<LeadDetail>(
    `/api/v1/sales/leads/${encodeURIComponent(leadId)}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    },
    "Unable to update lead"
  );
}

export async function convertLead(leadId: string): Promise<LeadConversionResponse> {
  return requestJson<LeadConversionResponse>(
    `/api/v1/sales/leads/${encodeURIComponent(leadId)}/convert`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: "{}"
    },
    "Unable to convert lead"
  );
}

export async function listClients(): Promise<{ items: ClientSummary[]; total: number }> {
  return requestJson<{ items: ClientSummary[]; total: number }>(
    "/api/v1/sales/clients",
    { method: "GET" },
    "Unable to load clients"
  );
}
