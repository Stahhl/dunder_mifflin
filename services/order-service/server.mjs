import { createServer } from "node:http";

const serverPort = Number.parseInt(process.env.SERVER_PORT ?? "8093", 10);

let orderCounter = 9000;
const orders = new Map();
const timelines = new Map();

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    },
    body: JSON.stringify(payload)
  };
}

function send(res, response) {
  res.writeHead(response.statusCode, response.headers);
  res.end(response.body);
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

function validateOrderRequest(payload) {
  const details = [];

  if (!payload || typeof payload !== "object") {
    details.push({ field: "body", issue: "required" });
  }

  if (typeof payload.clientId !== "string" || payload.clientId.trim() === "") {
    details.push({ field: "clientId", issue: "required" });
  }

  if (typeof payload.requestedShipDate !== "string" || payload.requestedShipDate.trim() === "") {
    details.push({ field: "requestedShipDate", issue: "required" });
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    details.push({ field: "items", issue: "min:1" });
  } else {
    payload.items.forEach((item, index) => {
      if (!item || typeof item.sku !== "string" || item.sku.trim() === "") {
        details.push({ field: `items[${index}].sku`, issue: "required" });
      }

      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        details.push({ field: `items[${index}].quantity`, issue: "min:1" });
      }
    });
  }

  return details;
}

function ensureGatewayIdentity(req) {
  const userId = req.headers["x-user-id"];
  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    return null;
  }
  return userId;
}

function createOrder(payload, createdBy) {
  orderCounter += 1;
  const orderId = `ord_${orderCounter}`;
  const createdAt = new Date().toISOString();

  const order = {
    orderId,
    clientId: payload.clientId,
    requestedShipDate: payload.requestedShipDate,
    items: payload.items,
    notes: payload.notes ?? "",
    createdBy,
    status: "CREATED",
    createdAt,
    shipmentId: null
  };

  orders.set(orderId, order);
  timelines.set(orderId, [
    {
      status: "CREATED",
      at: createdAt,
      source: "order-service"
    }
  ]);

  return order;
}

function toOrderSummary(order) {
  return {
    orderId: order.orderId,
    clientId: order.clientId,
    status: order.status,
    requestedShipDate: order.requestedShipDate,
    createdAt: order.createdAt
  };
}

async function handleRequest(req) {
  const parsedUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const path = parsedUrl.pathname;

  if (req.method === "GET" && path === "/actuator/health") {
    return jsonResponse(200, { status: "UP", service: "order-service" });
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

    const order = createOrder(payload, userId);
    return jsonResponse(201, {
      orderId: order.orderId,
      status: order.status,
      createdAt: order.createdAt
    });
  }

  if (req.method === "GET" && path === "/internal/orders") {
    const clientIdFilter = parsedUrl.searchParams.get("clientId");
    const items = [...orders.values()]
      .filter((order) => (clientIdFilter ? order.clientId === clientIdFilter : true))
      .map(toOrderSummary)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    return jsonResponse(200, {
      items,
      total: items.length
    });
  }

  const pathParams = getPathParams(path);
  if (!pathParams) {
    return jsonResponse(404, { error: { code: "NOT_FOUND", message: "Order route not found" } });
  }

  const order = orders.get(pathParams.orderId);
  if (!order) {
    return jsonResponse(404, {
      error: {
        code: "ORDER_NOT_FOUND",
        message: `Order ${pathParams.orderId} was not found`
      }
    });
  }

  if (req.method === "GET" && pathParams.timeline) {
    return jsonResponse(200, {
      orderId: order.orderId,
      events: timelines.get(order.orderId) ?? []
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

const server = createServer(async (req, res) => {
  try {
    const response = await handleRequest(req);
    send(res, response);
  } catch (errorObject) {
    const message = errorObject instanceof Error ? errorObject.message : "Unknown order-service error";
    send(
      res,
      jsonResponse(500, {
        error: {
          code: "INTERNAL_ERROR",
          message
        }
      })
    );
  }
});

server.listen(serverPort, "0.0.0.0", () => {
  console.log(`Order service listening on ${serverPort}`);
});
