import assert from "node:assert/strict";
import test from "node:test";
import amqp from "amqplib";
import { RabbitDomainEventPublisher } from "../src/messaging/rabbit-publisher.mjs";
import { PostgresOrderStore } from "../src/store/postgres-order-store.mjs";

const postgresConfig = {
  host: process.env.POSTGRES_HOST ?? "postgres",
  port: Number.parseInt(process.env.POSTGRES_PORT ?? "5432", 10),
  database: process.env.POSTGRES_DB ?? "dundermifflin",
  user: process.env.POSTGRES_USER ?? "dundermifflin",
  password: process.env.POSTGRES_PASSWORD ?? "bears_beets_battlestar"
};

const amqpUrl =
  process.env.RABBITMQ_URL ??
  buildAmqpUrl({
    user: process.env.RABBITMQ_DEFAULT_USER ?? "dunder",
    password: process.env.RABBITMQ_DEFAULT_PASS ?? "mifflin",
    host: process.env.RABBITMQ_HOST ?? "rabbitmq",
    port: Number.parseInt(process.env.RABBITMQ_AMQP_PORT ?? "5672", 10),
    vhost: process.env.RABBITMQ_VHOST ?? "/"
  });

const exchange = process.env.RABBITMQ_EXCHANGE ?? "dm.domain.events";

test("postgres adapter persists and reads orders and timeline", async (context) => {
  const store = new PostgresOrderStore(postgresConfig);
  context.after(async () => {
    await store.close();
  });

  await store.init();

  const created = await store.createOrder({
    clientId: `it_client_${Date.now()}`,
    requestedShipDate: "2026-03-01",
    items: [{ sku: "PPR-A4-WHT-500", quantity: 7 }],
    notes: "integration test",
    createdBy: "jhalpert"
  });

  assert.match(created.orderId, /^ord_\d+$/);

  const detail = await store.getOrderById(created.orderId);
  assert.ok(detail);
  assert.equal(detail.orderId, created.orderId);
  assert.equal(detail.status, "CREATED");
  assert.equal(detail.items.length, 1);

  const timeline = await store.getTimeline(created.orderId);
  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].status, "CREATED");

  const list = await store.listOrders({ clientId: created.clientId });
  assert.ok(list.some((order) => order.orderId === created.orderId));
});

test("rabbit adapter publishes order.created.v1 cloud event", async (context) => {
  const publisher = new RabbitDomainEventPublisher({
    amqpUrl,
    exchange
  });
  await publisher.connect();
  context.after(async () => {
    await closeQuietly(() => publisher.close());
  });

  const consumerConnection = await amqp.connect(amqpUrl);
  context.after(async () => {
    await closeQuietly(() => consumerConnection.close());
  });

  const consumerChannel = await consumerConnection.createChannel();
  context.after(async () => {
    await closeQuietly(() => consumerChannel.close());
  });

  await consumerChannel.assertExchange(exchange, "topic", { durable: true });
  const queueResult = await consumerChannel.assertQueue("", { exclusive: true, autoDelete: true });
  await consumerChannel.bindQueue(queueResult.queue, exchange, "order.created.v1");

  const sampleOrder = {
    orderId: `ord_it_${Date.now()}`,
    clientId: "client_it_501",
    items: [{ sku: "PPR-A4-WHT-500", quantity: 5 }],
    createdBy: "jhalpert",
    createdAt: new Date().toISOString()
  };

  await publisher.publishOrderCreated(sampleOrder);

  const message = await waitForMessage(consumerChannel, queueResult.queue);
  assert.ok(message, "expected order.created.v1 event message");

  const payload = JSON.parse(message.content.toString("utf8"));
  assert.equal(payload.type, "com.dundermifflin.order.created.v1");
  assert.equal(payload.data.orderId, sampleOrder.orderId);
  assert.equal(payload.data.clientId, sampleOrder.clientId);
});

async function waitForMessage(channel, queueName) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const message = await channel.get(queueName, { noAck: true });
    if (message) {
      return message;
    }
    await sleep(100);
  }
  return null;
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function buildAmqpUrl({ user, password, host, port, vhost }) {
  const encodedVhost = vhost === "/" ? "%2F" : encodeURIComponent(vhost);
  return `amqp://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodedVhost}`;
}

async function closeQuietly(closeFn) {
  try {
    await closeFn();
  } catch {
    // Ignore teardown close races when dependency closes first.
  }
}
