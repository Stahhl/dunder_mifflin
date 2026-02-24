const DEFAULT_TIMEOUT_MS = 180_000;
const RETRY_INTERVAL_MS = 1_500;

function requiredEnv(name, fallback = undefined) {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

const config = {
  rabbitManagementUrl: requiredEnv("BI_TEST_RABBITMQ_MANAGEMENT_URL", "http://rabbitmq:15672"),
  rabbitUser: requiredEnv("BI_TEST_RABBITMQ_USER", "dunder"),
  rabbitPass: requiredEnv("BI_TEST_RABBITMQ_PASS", "mifflin"),
  exchange: requiredEnv("BI_TEST_EVENT_EXCHANGE", "dm.domain.events"),
  clickhouseUrl: requiredEnv("BI_TEST_CLICKHOUSE_URL", "http://clickhouse:8123"),
  clickhouseDb: requiredEnv("BI_TEST_CLICKHOUSE_DB", "bi_warehouse"),
  clickhouseIngestorUser: requiredEnv("BI_TEST_CLICKHOUSE_INGESTOR_USER", "bi_ingestor"),
  clickhouseIngestorPass: requiredEnv("BI_TEST_CLICKHOUSE_INGESTOR_PASSWORD", "bi_ingestor_password"),
  clickhouseReaderUser: requiredEnv("BI_TEST_CLICKHOUSE_READER_USER", "bi_reader"),
  clickhouseReaderPass: requiredEnv("BI_TEST_CLICKHOUSE_READER_PASSWORD", "bi_reader_password"),
  minioUrl: requiredEnv("BI_TEST_MINIO_URL", "http://minio:9000"),
  metabaseUrl: requiredEnv("BI_TEST_METABASE_URL", "http://metabase:3000"),
  ingestionUrl: requiredEnv("BI_TEST_INGESTION_URL", "http://bi-ingestion-service:8097"),
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function authHeader(user, pass) {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
}

async function waitFor(name, operation, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const started = Date.now();
  let lastError = null;

  while (Date.now() - started < timeoutMs) {
    try {
      await operation();
      return;
    } catch (error) {
      lastError = error;
      await sleep(RETRY_INTERVAL_MS);
    }
  }

  throw new Error(`Timed out waiting for ${name}: ${lastError?.message ?? "unknown error"}`);
}

async function rabbitReady() {
  const response = await fetch(`${config.rabbitManagementUrl}/api/overview`, {
    headers: {
      Authorization: authHeader(config.rabbitUser, config.rabbitPass),
    },
  });

  if (!response.ok) {
    throw new Error(`RabbitMQ management not ready: HTTP ${response.status}`);
  }
}

async function minioReady() {
  const response = await fetch(`${config.minioUrl}/minio/health/ready`);
  if (!response.ok) {
    throw new Error(`MinIO not ready: HTTP ${response.status}`);
  }
}

async function metabaseReady() {
  const response = await fetch(`${config.metabaseUrl}/api/health`);
  if (!response.ok) {
    throw new Error(`Metabase not ready: HTTP ${response.status}`);
  }

  const body = await response.json();
  if (body.status !== "ok") {
    throw new Error(`Metabase health mismatch: ${JSON.stringify(body)}`);
  }
}

async function ingestionReady() {
  const response = await fetch(`${config.ingestionUrl}/actuator/health`);
  if (!response.ok) {
    throw new Error(`BI ingestion service not ready: HTTP ${response.status}`);
  }

  const health = await response.json();
  if (health.status !== "UP") {
    throw new Error(`BI ingestion health mismatch: ${JSON.stringify(health)}`);
  }
}

async function clickhouseRequest({ query, user, pass }) {
  const response = await fetch(`${config.clickhouseUrl}/?database=${encodeURIComponent(config.clickhouseDb)}`, {
    method: "POST",
    headers: {
      "X-ClickHouse-User": user,
      "X-ClickHouse-Key": pass,
      "Content-Type": "text/plain; charset=utf-8",
    },
    body: query,
  });

  const body = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}

async function clickhouseExec(query) {
  const result = await clickhouseRequest({
    query,
    user: config.clickhouseIngestorUser,
    pass: config.clickhouseIngestorPass,
  });

  if (!result.ok) {
    throw new Error(`ClickHouse query failed (${result.status}): ${result.body}`);
  }

  return result.body;
}

async function clickhouseCount(table, eventId) {
  const sql = `SELECT count() FROM ${config.clickhouseDb}.${table} WHERE event_id = '${eventId}' FORMAT TabSeparated`;
  const value = await clickhouseExec(sql);
  const parsed = Number.parseInt(value.trim(), 10);

  if (Number.isNaN(parsed)) {
    throw new Error(`Unable to parse count for ${table}/${eventId}: ${value}`);
  }

  return parsed;
}

async function publishEvent(routingKey, payload) {
  const response = await fetch(
    `${config.rabbitManagementUrl}/api/exchanges/%2f/${encodeURIComponent(config.exchange)}/publish`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(config.rabbitUser, config.rabbitPass),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          delivery_mode: 2,
          content_type: "application/cloudevents+json",
          message_id: payload.id,
          type: payload.type,
        },
        routing_key: routingKey,
        payload: JSON.stringify(payload),
        payload_encoding: "string",
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to publish ${routingKey}: HTTP ${response.status}`);
  }

  const result = await response.json();
  if (!result.routed) {
    throw new Error(`Event ${payload.id} was not routed for key ${routingKey}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} (expected=${expected}, actual=${actual})`);
  }
}

async function main() {
  console.log("[bi-e2e] Waiting for BI dependencies...");
  await waitFor("RabbitMQ", rabbitReady);
  await waitFor("ClickHouse", async () => {
    const result = await clickhouseRequest({
      query: "SELECT 1 FORMAT TabSeparated",
      user: config.clickhouseIngestorUser,
      pass: config.clickhouseIngestorPass,
    });

    if (!result.ok || result.body.trim() !== "1") {
      throw new Error(`ClickHouse not ready: HTTP ${result.status} ${result.body}`);
    }
  });
  await waitFor("MinIO", minioReady);
  await waitFor("Metabase", metabaseReady);
  await waitFor("BI ingestion service", ingestionReady);

  console.log("[bi-e2e] Resetting BI fact tables for deterministic assertions...");
  await clickhouseExec(`TRUNCATE TABLE ${config.clickhouseDb}.fact_orders`);
  await clickhouseExec(`TRUNCATE TABLE ${config.clickhouseDb}.fact_shipments`);
  await clickhouseExec(`TRUNCATE TABLE ${config.clickhouseDb}.fact_expenses`);
  await clickhouseExec(`TRUNCATE TABLE ${config.clickhouseDb}.raw_domain_events`);

  const marker = Date.now();
  const nowIso = new Date().toISOString();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const orderEventId = `evt_bi_order_${marker}`;
  const shipmentEventId = `evt_bi_shipment_${marker}`;
  const expenseEventId = `evt_bi_expense_${marker}`;

  const orderEvent = {
    specversion: "1.0",
    id: orderEventId,
    type: "com.dundermifflin.order.created.v1",
    source: "/order-service",
    subject: `order/ord_bi_${marker}`,
    time: nowIso,
    datacontenttype: "application/json",
    data: {
      orderId: `ord_bi_${marker}`,
      clientId: `client_bi_${marker}`,
      requestedShipDate: tomorrow,
      createdBy: "jhalpert",
      createdAt: nowIso,
      items: [
        { sku: "PPR-A4-WHT-500", quantity: 3 },
        { sku: "PPR-A4-WHT-500", quantity: 2 },
      ],
    },
  };

  const shipmentEvent = {
    specversion: "1.0",
    id: shipmentEventId,
    type: "com.dundermifflin.shipment.dispatched.v1",
    source: "/inventory-service",
    subject: `shipment/ship_bi_${marker}`,
    time: nowIso,
    datacontenttype: "application/json",
    data: {
      shipmentId: `ship_bi_${marker}`,
      orderId: `ord_bi_${marker}`,
      orderCreatedBy: "jhalpert",
      dispatchedBy: "dphilbin",
      truckId: "truck_scr_02",
      dispatchedAt: nowIso,
    },
  };

  const expenseEvent = {
    specversion: "1.0",
    id: expenseEventId,
    type: "com.dundermifflin.expense.decided.v1",
    source: "/finance-service",
    subject: `expense/exp_bi_${marker}`,
    time: nowIso,
    datacontenttype: "application/json",
    data: {
      expenseId: `exp_bi_${marker}`,
      submitterUserId: "mscott",
      decision: "REJECTED",
      decidedBy: "amartin",
      comment: "Manual BI test",
      decidedAt: nowIso,
    },
  };

  console.log("[bi-e2e] Publishing initial event batch...");
  await publishEvent("order.created.v1", orderEvent);
  await publishEvent("shipment.dispatched.v1", shipmentEvent);
  await publishEvent("finance.expense.decided.v1", expenseEvent);

  await waitFor("ingested raw/fact rows", async () => {
    assertEqual(await clickhouseCount("raw_domain_events", orderEventId), 1, "raw order event count mismatch");
    assertEqual(await clickhouseCount("raw_domain_events", shipmentEventId), 1, "raw shipment event count mismatch");
    assertEqual(await clickhouseCount("raw_domain_events", expenseEventId), 1, "raw expense event count mismatch");
    assertEqual(await clickhouseCount("fact_orders", orderEventId), 1, "fact_orders row count mismatch");
    assertEqual(await clickhouseCount("fact_shipments", shipmentEventId), 1, "fact_shipments row count mismatch");
    assertEqual(await clickhouseCount("fact_expenses", expenseEventId), 1, "fact_expenses row count mismatch");
  });

  console.log("[bi-e2e] Replaying same events to verify idempotency...");
  await publishEvent("order.created.v1", orderEvent);
  await publishEvent("shipment.dispatched.v1", shipmentEvent);
  await publishEvent("finance.expense.decided.v1", expenseEvent);

  await sleep(4_000);

  assertEqual(await clickhouseCount("raw_domain_events", orderEventId), 1, "raw order duplicate detected");
  assertEqual(await clickhouseCount("raw_domain_events", shipmentEventId), 1, "raw shipment duplicate detected");
  assertEqual(await clickhouseCount("raw_domain_events", expenseEventId), 1, "raw expense duplicate detected");
  assertEqual(await clickhouseCount("fact_orders", orderEventId), 1, "fact_orders duplicate detected");
  assertEqual(await clickhouseCount("fact_shipments", shipmentEventId), 1, "fact_shipments duplicate detected");
  assertEqual(await clickhouseCount("fact_expenses", expenseEventId), 1, "fact_expenses duplicate detected");

  console.log("[bi-e2e] Verifying read-only BI user cannot mutate warehouse...");
  const readonlyMutation = await clickhouseRequest({
    query: `INSERT INTO ${config.clickhouseDb}.fact_orders (event_id, order_id, client_id, created_by, requested_ship_date, item_count, total_quantity, occurred_at, ingested_at) VALUES ('evt_readonly_${marker}', 'ord_readonly_${marker}', 'client_readonly', 'readonly', NULL, 1, 1, now(), now())`,
    user: config.clickhouseReaderUser,
    pass: config.clickhouseReaderPass,
  });

  if (readonlyMutation.ok) {
    throw new Error(`Expected read-only mutation to fail, but insert succeeded: ${readonlyMutation.body}`);
  }

  console.log("[bi-e2e] BI pipeline checks passed.");
}

main().catch((error) => {
  console.error("[bi-e2e] FAILED:", error);
  process.exitCode = 1;
});
