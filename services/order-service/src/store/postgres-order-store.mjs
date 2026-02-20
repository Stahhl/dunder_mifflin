import pg from "pg";

const { Pool } = pg;

const CREATED_STATUS = "CREATED";
const ORDER_SOURCE = "order-service";

const INIT_SQL = `
CREATE SCHEMA IF NOT EXISTS orders;

CREATE SEQUENCE IF NOT EXISTS orders.order_number_seq START 9001;

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
  ON orders.order_timeline (order_id, at);
`;

export class PostgresOrderStore {
  constructor(config) {
    this.pool = new Pool(config);
  }

  async init() {
    await this.pool.query("SELECT 1");
    await this.pool.query(INIT_SQL);
  }

  async isHealthy() {
    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  async createOrder({ clientId, requestedShipDate, items, notes, createdBy }) {
    const connection = await this.pool.connect();
    const createdAt = new Date().toISOString();

    try {
      await connection.query("BEGIN");

      const idResult = await connection.query("SELECT 'ord_' || nextval('orders.order_number_seq') AS order_id");
      const orderId = idResult.rows[0].order_id;
      const cleanNotes = typeof notes === "string" ? notes : "";

      await connection.query(
        `
        INSERT INTO orders.orders (
          order_id,
          client_id,
          requested_ship_date,
          items,
          notes,
          created_by,
          status,
          created_at,
          shipment_id
        ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9)
        `,
        [orderId, clientId, requestedShipDate, JSON.stringify(items), cleanNotes, createdBy, CREATED_STATUS, createdAt, null]
      );

      await connection.query(
        `
        INSERT INTO orders.order_timeline (order_id, status, at, source)
        VALUES ($1, $2, $3, $4)
        `,
        [orderId, CREATED_STATUS, createdAt, ORDER_SOURCE]
      );

      await connection.query("COMMIT");

      return {
        orderId,
        clientId,
        requestedShipDate,
        items,
        notes: cleanNotes,
        createdBy,
        status: CREATED_STATUS,
        createdAt,
        shipmentId: null
      };
    } catch (errorObject) {
      await connection.query("ROLLBACK");
      throw errorObject;
    } finally {
      connection.release();
    }
  }

  async listOrders({ clientId }) {
    const values = [];
    let whereClause = "";

    if (clientId) {
      values.push(clientId);
      whereClause = "WHERE client_id = $1";
    }

    const result = await this.pool.query(
      `
      SELECT order_id, client_id, status, requested_ship_date, created_at
      FROM orders.orders
      ${whereClause}
      ORDER BY created_at ASC
      `,
      values
    );

    return result.rows.map((row) => ({
      orderId: row.order_id,
      clientId: row.client_id,
      status: row.status,
      requestedShipDate: toIsoDate(row.requested_ship_date),
      createdAt: new Date(row.created_at).toISOString()
    }));
  }

  async getOrderById(orderId) {
    const result = await this.pool.query(
      `
      SELECT
        order_id,
        client_id,
        requested_ship_date,
        items,
        notes,
        created_by,
        status,
        created_at,
        shipment_id
      FROM orders.orders
      WHERE order_id = $1
      `,
      [orderId]
    );

    if (result.rowCount === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      orderId: row.order_id,
      clientId: row.client_id,
      requestedShipDate: toIsoDate(row.requested_ship_date),
      items: parseItems(row.items),
      notes: row.notes,
      createdBy: row.created_by,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
      shipmentId: row.shipment_id
    };
  }

  async getTimeline(orderId) {
    const result = await this.pool.query(
      `
      SELECT status, at, source
      FROM orders.order_timeline
      WHERE order_id = $1
      ORDER BY at ASC, id ASC
      `,
      [orderId]
    );

    return result.rows.map((row) => ({
      status: row.status,
      at: new Date(row.at).toISOString(),
      source: row.source
    }));
  }

  async close() {
    await this.pool.end();
  }
}

function parseItems(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function toIsoDate(value) {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return "";
}
