import type { ShipmentListResponse } from "../types/warehouse";

export async function fetchPendingShipments(gatewayBaseUrl: string, accessToken: string): Promise<ShipmentListResponse> {
  const response = await fetch(`${gatewayBaseUrl}/api/v1/warehouse/shipments?status=PENDING`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json"
    }
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Unable to load shipments");
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
  const response = await fetch(`${gatewayBaseUrl}/api/v1/warehouse/shipments/${encodeURIComponent(shipmentId)}/scan`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      accept: "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
    },
    body: JSON.stringify({
      barcode,
      quantity
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Scan request failed");
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

  const response = await fetch(`${gatewayBaseUrl}/api/v1/warehouse/shipments/${encodeURIComponent(shipmentId)}/dispatch`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      accept: "application/json",
      "Idempotency-Key": effectiveIdempotencyKey
    },
    body: JSON.stringify({
      truckId,
      dispatchedAt: effectiveDispatchedAt
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Dispatch request failed");
  }

  return {
    shipmentId: payload.shipmentId,
    orderStatus: payload.orderStatus
  };
}
