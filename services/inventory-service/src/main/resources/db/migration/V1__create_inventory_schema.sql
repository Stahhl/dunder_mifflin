CREATE SCHEMA IF NOT EXISTS inventory;

CREATE TABLE IF NOT EXISTS inventory.shipments (
  shipment_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  requested_ship_date DATE NOT NULL,
  items JSONB NOT NULL CHECK (jsonb_typeof(items) = 'array'),
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  dispatched_at TIMESTAMPTZ NULL,
  dispatched_by TEXT NULL,
  truck_id TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_shipments_status_created_at
  ON inventory.shipments (status, created_at);

CREATE TABLE IF NOT EXISTS inventory.shipment_scan_log (
  id BIGSERIAL PRIMARY KEY,
  shipment_id TEXT NOT NULL REFERENCES inventory.shipments(shipment_id) ON DELETE CASCADE,
  barcode TEXT NOT NULL,
  quantity INT NOT NULL,
  scanned_by TEXT NOT NULL,
  scanned_at TIMESTAMPTZ NOT NULL,
  idempotency_key TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_scan_log_shipment_scanned_at
  ON inventory.shipment_scan_log (shipment_id, scanned_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_inventory_scan_idempotency
  ON inventory.shipment_scan_log (shipment_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS inventory.idempotency_records (
  operation_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  shipment_id TEXT NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (operation_type, idempotency_key)
);
