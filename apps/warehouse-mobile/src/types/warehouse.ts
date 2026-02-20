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
