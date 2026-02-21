import type { ShipmentListResponse } from "../types/warehouse";
import { appendTraceToMessage, applyTraceHeaders } from "./trace";

export async function fetchPendingShipments(gatewayBaseUrl: string, accessToken: string): Promise<ShipmentListResponse> {
  const headers = applyTraceHeaders({
    authorization: `Bearer ${accessToken}`,
    accept: "application/json"
  });

  const response = await fetch(`${gatewayBaseUrl}/api/v1/warehouse/shipments?status=PENDING`, {
    headers
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(appendTraceToMessage(payload?.error?.message ?? "Unable to load shipments", response));
  }

  return {
    items: payload?.items ?? [],
    total: payload?.total ?? 0
  };
}

export async function submitMockScan(
  gatewayBaseUrl: string,
  accessToken: string,
  shipmentId: string,
  barcode: string,
  quantity: number,
  idempotencyKey?: string
): Promise<void> {
  const headers = applyTraceHeaders({
    authorization: `Bearer ${accessToken}`,
    "content-type": "application/json",
    accept: "application/json",
    ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
  });

  const response = await fetch(`${gatewayBaseUrl}/api/v1/warehouse/shipments/${encodeURIComponent(shipmentId)}/scan`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      barcode,
      quantity
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(appendTraceToMessage(payload?.error?.message ?? "Scan request failed", response));
  }
}

export type DispatchResult = {
  shipmentId: string;
  orderStatus: string;
};

export async function dispatchShipment(
  gatewayBaseUrl: string,
  accessToken: string,
  shipmentId: string,
  truckId: string,
  idempotencyKey?: string,
  dispatchedAt?: string
): Promise<DispatchResult> {
  const effectiveIdempotencyKey = idempotencyKey ?? `wm_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const effectiveDispatchedAt = dispatchedAt ?? new Date().toISOString();
  const headers = applyTraceHeaders({
    authorization: `Bearer ${accessToken}`,
    "content-type": "application/json",
    accept: "application/json",
    "Idempotency-Key": effectiveIdempotencyKey
  });

  const response = await fetch(`${gatewayBaseUrl}/api/v1/warehouse/shipments/${encodeURIComponent(shipmentId)}/dispatch`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      truckId,
      dispatchedAt: effectiveDispatchedAt
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(appendTraceToMessage(payload?.error?.message ?? "Dispatch request failed", response));
  }

  return {
    shipmentId: payload.shipmentId,
    orderStatus: payload.orderStatus
  };
}
