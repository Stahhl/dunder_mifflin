import { validateOrderRequest } from "./validation.mjs";

export function createOrderApp({ orderStore, eventPublisher, logger = console }) {
  async function handleRequest(req) {
    const parsedUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const path = parsedUrl.pathname;

    if (req.method === "GET" && path === "/actuator/health") {
      const [postgresReady, rabbitReady] = await Promise.all([
        orderStore.isHealthy(),
        Promise.resolve(eventPublisher.isHealthy())
      ]);
      const healthy = postgresReady && rabbitReady;

      return jsonResponse(healthy ? 200 : 503, {
        status: healthy ? "UP" : "DEGRADED",
        service: "order-service",
        checks: {
          postgres: postgresReady ? "UP" : "DOWN",
          rabbitmq: rabbitReady ? "UP" : "DOWN"
        }
      });
    }

    if (!path.startsWith("/internal/orders")) {
      return jsonResponse(404, { error: { code: "NOT_FOUND", message: "Route not found" } });
    }

    const userId = ensureGatewayIdentity(req);
    if (!userId) {
      return jsonResponse(401, {
        error: {
          code: "UNAUTHENTICATED",
          message: "x-user-id header is required for internal endpoints"
        }
      });
    }

    if (req.method === "POST" && path === "/internal/orders") {
      let payload;
      try {
        payload = await readJsonBody(req);
      } catch (errorObject) {
        return jsonResponse(400, {
          error: {
            code: "INVALID_JSON",
            message: errorObject instanceof Error ? errorObject.message : "Invalid JSON payload"
          }
        });
      }

      const details = validateOrderRequest(payload);
      if (details.length > 0) {
        return jsonResponse(400, {
          error: {
            code: "VALIDATION_ERROR",
            message: "Order request validation failed",
            details
          }
        });
      }

      const order = await orderStore.createOrder({
        clientId: payload.clientId.trim(),
        requestedShipDate: payload.requestedShipDate.trim(),
        items: payload.items.map((item) => ({ sku: item.sku.trim(), quantity: item.quantity })),
        notes: typeof payload.notes === "string" ? payload.notes : "",
        createdBy: userId
      });

      // Publish is best-effort for this demo phase; order persistence is primary.
      try {
        await eventPublisher.publishOrderCreated(order);
      } catch (errorObject) {
        logger.error("Failed to publish order.created.v1 in order-service", errorObject);
      }

      return jsonResponse(201, {
        orderId: order.orderId,
        status: order.status,
        createdAt: order.createdAt
      });
    }

    if (req.method === "GET" && path === "/internal/orders") {
      const clientIdFilter = parsedUrl.searchParams.get("clientId");
      const items = await orderStore.listOrders({ clientId: clientIdFilter });

      return jsonResponse(200, {
        items,
        total: items.length
      });
    }

    const pathParams = getPathParams(path);
    if (!pathParams) {
      return jsonResponse(404, { error: { code: "NOT_FOUND", message: "Order route not found" } });
    }

    const order = await orderStore.getOrderById(pathParams.orderId);
    if (!order) {
      return jsonResponse(404, {
        error: {
          code: "ORDER_NOT_FOUND",
          message: `Order ${pathParams.orderId} was not found`
        }
      });
    }

    if (req.method === "GET" && pathParams.timeline) {
      const events = await orderStore.getTimeline(pathParams.orderId);
      return jsonResponse(200, {
        orderId: order.orderId,
        events
      });
    }

    if (req.method === "GET") {
      return jsonResponse(200, order);
    }

    return jsonResponse(405, {
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: `Method ${req.method ?? "UNKNOWN"} is not supported`
      }
    });
  }

  return { handleRequest };
}

export function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    },
    body: JSON.stringify(payload)
  };
}

export function ensureGatewayIdentity(req) {
  const userId = req.headers["x-user-id"];
  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    return null;
  }
  return userId;
}

function getPathParams(path) {
  const timelineMatch = path.match(/^\/internal\/orders\/([^/]+)\/timeline$/);
  if (timelineMatch) {
    return { orderId: timelineMatch[1], timeline: true };
  }

  const detailMatch = path.match(/^\/internal\/orders\/([^/]+)$/);
  if (detailMatch) {
    return { orderId: detailMatch[1], timeline: false };
  }

  return null;
}

async function readJsonBody(req) {
  const chunks = [];
  let totalLength = 0;

  for await (const chunk of req) {
    totalLength += chunk.length;
    if (totalLength > 512 * 1024) {
      throw new Error("Payload too large");
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
