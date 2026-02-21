export type ShipmentItem = {
  sku: string;
  quantity: number;
};

export type ShipmentSummary = {
  shipmentId: string;
  orderId: string;
  clientId: string;
  status: string;
  requestedShipDate: string;
  createdAt: string;
  items: ShipmentItem[];
};

export type ShipmentListResponse = {
  items: ShipmentSummary[];
  total: number;
};

export type JwtClaims = {
  preferred_username?: string;
  realm_access?: {
    roles?: string[];
  };
};

export type RuntimeConfig = {
  gatewayBaseUrl: string;
  keycloakBaseUrl: string;
  realm: string;
  clientId: string;
};

export type OfflineScanPayload = {
  barcode: string;
  quantity: number;
  scannedAt: string;
};

export type OfflineDispatchPayload = {
  truckId: string;
  dispatchedAt: string;
};

export type OfflineOperation =
  | {
      operationId: string;
      kind: "scan";
      shipmentId: string;
      idempotencyKey: string;
      createdAt: string;
      attempts: number;
      payload: OfflineScanPayload;
    }
  | {
      operationId: string;
      kind: "dispatch";
      shipmentId: string;
      idempotencyKey: string;
      createdAt: string;
      attempts: number;
      payload: OfflineDispatchPayload;
    };
