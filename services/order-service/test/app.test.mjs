import assert from "node:assert/strict";
import test from "node:test";
import { createOrderApp } from "../src/app.mjs";

test("POST /internal/orders persists and publishes", async () => {
  const persistedInputs = [];
  const publishedOrders = [];

  const orderStore = {
    async isHealthy() {
      return true;
    },
    async createOrder(input) {
      persistedInputs.push(input);
      return {
        orderId: "ord_9001",
        status: "CREATED",
        createdAt: "2026-02-20T14:00:00.000Z",
        ...input,
        shipmentId: null
      };
    },
    async listOrders() {
      return [];
    },
    async getOrderById() {
      return null;
    },
    async getTimeline() {
      return [];
    }
  };

  const eventPublisher = {
    isHealthy() {
      return true;
    },
    async publishOrderCreated(order) {
      publishedOrders.push(order);
    }
  };

  const app = createOrderApp({ orderStore, eventPublisher });
  const response = await app.handleRequest(
    requestWithJsonBody({
      method: "POST",
      url: "/internal/orders",
      headers: { host: "localhost", "x-user-id": "jhalpert" },
      body: {
        clientId: "client_501",
        requestedShipDate: "2026-02-25",
        items: [{ sku: "PPR-A4-WHT-500", quantity: 10 }],
        notes: "Front desk delivery"
      }
    })
  );

  assert.equal(response.statusCode, 201);

  const body = JSON.parse(response.body);
  assert.deepEqual(body, {
    orderId: "ord_9001",
    status: "CREATED",
    createdAt: "2026-02-20T14:00:00.000Z"
  });

  assert.equal(persistedInputs.length, 1);
  assert.equal(persistedInputs[0].createdBy, "jhalpert");
  assert.equal(publishedOrders.length, 1);
  assert.equal(publishedOrders[0].orderId, "ord_9001");
});

test("rejects internal order routes without gateway identity", async () => {
  const app = createOrderApp({
    orderStore: {
      async isHealthy() {
        return true;
      }
    },
    eventPublisher: {
      isHealthy() {
        return true;
      }
    }
  });

  const response = await app.handleRequest(
    requestWithJsonBody({
      method: "GET",
      url: "/internal/orders",
      headers: { host: "localhost" }
    })
  );

  assert.equal(response.statusCode, 401);
  assert.equal(JSON.parse(response.body).error.code, "UNAUTHENTICATED");
});

test("GET /actuator/health reports dependency state", async () => {
  const app = createOrderApp({
    orderStore: {
      async isHealthy() {
        return true;
      }
    },
    eventPublisher: {
      isHealthy() {
        return false;
      }
    }
  });

  const response = await app.handleRequest(
    requestWithJsonBody({
      method: "GET",
      url: "/actuator/health",
      headers: { host: "localhost" }
    })
  );

  assert.equal(response.statusCode, 503);

  const body = JSON.parse(response.body);
  assert.equal(body.status, "DEGRADED");
  assert.equal(body.checks.postgres, "UP");
  assert.equal(body.checks.rabbitmq, "DOWN");
});

function requestWithJsonBody({ method, url, headers, body }) {
  const payload = body === undefined ? null : Buffer.from(JSON.stringify(body), "utf8");

  return {
    method,
    url,
    headers,
    async *[Symbol.asyncIterator]() {
      if (payload) {
        yield payload;
      }
    }
  };
}
