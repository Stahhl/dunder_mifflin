CREATE SCHEMA IF NOT EXISTS orders;

CREATE SEQUENCE IF NOT EXISTS orders.order_number_seq START WITH 9001;

CREATE TABLE IF NOT EXISTS orders.orders (
  order_id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  requested_ship_date DATE NOT NULL,
  items JSONB NOT NULL CHECK (jsonb_typeof(items) = 'array'),
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  shipment_id TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_client_created_at
  ON orders.orders (client_id, created_at);

CREATE TABLE IF NOT EXISTS orders.order_timeline (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders.orders(order_id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_timeline_order_at
  ON orders.order_timeline (order_id, at, id);
