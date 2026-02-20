import { createServer } from "node:http";
import { createOrderApp, jsonResponse } from "./app.mjs";
import { RabbitDomainEventPublisher } from "./messaging/rabbit-publisher.mjs";
import { PostgresOrderStore } from "./store/postgres-order-store.mjs";

const serverPort = Number.parseInt(process.env.SERVER_PORT ?? "8093", 10);
const startupRetryAttempts = Number.parseInt(process.env.STARTUP_RETRY_ATTEMPTS ?? "30", 10);
const startupRetryDelayMs = Number.parseInt(process.env.STARTUP_RETRY_DELAY_MS ?? "1000", 10);

const orderStore = new PostgresOrderStore({
  host: process.env.POSTGRES_HOST ?? "postgres",
  port: Number.parseInt(process.env.POSTGRES_PORT ?? "5432", 10),
  database: process.env.POSTGRES_DB ?? "dundermifflin",
  user: process.env.POSTGRES_USER ?? "dundermifflin",
  password: process.env.POSTGRES_PASSWORD ?? "bears_beets_battlestar",
  max: Number.parseInt(process.env.POSTGRES_POOL_MAX ?? "10", 10)
});

const amqpUrl =
  process.env.RABBITMQ_URL ??
  buildAmqpUrl({
    user: process.env.RABBITMQ_DEFAULT_USER ?? "dunder",
    password: process.env.RABBITMQ_DEFAULT_PASS ?? "mifflin",
    host: process.env.RABBITMQ_HOST ?? "rabbitmq",
    port: Number.parseInt(process.env.RABBITMQ_AMQP_PORT ?? "5672", 10),
    vhost: process.env.RABBITMQ_VHOST ?? "/"
  });

const eventPublisher = new RabbitDomainEventPublisher({
  amqpUrl,
  exchange: process.env.RABBITMQ_EXCHANGE ?? "dm.domain.events"
});

await withRetry(() => orderStore.init(), {
  operation: "postgres init",
  attempts: startupRetryAttempts,
  delayMs: startupRetryDelayMs
});
await withRetry(() => eventPublisher.connect(), {
  operation: "rabbitmq connect",
  attempts: startupRetryAttempts,
  delayMs: startupRetryDelayMs
});

const app = createOrderApp({ orderStore, eventPublisher });

const server = createServer(async (req, res) => {
  try {
    const response = await app.handleRequest(req);
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

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  await new Promise((resolve) => {
    server.close(() => resolve());
  });

  await Promise.allSettled([eventPublisher.close(), orderStore.close()]);
  process.exit(0);
}

function send(res, response) {
  res.writeHead(response.statusCode, response.headers);
  res.end(response.body);
}

function buildAmqpUrl({ user, password, host, port, vhost }) {
  const encodedVhost = vhost === "/" ? "%2F" : encodeURIComponent(vhost);
  return `amqp://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodedVhost}`;
}

async function withRetry(operationFn, { operation, attempts, delayMs }) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operationFn();
    } catch (errorObject) {
      lastError = errorObject;
      console.error(
        `order-service startup: ${operation} failed (attempt ${attempt}/${attempts})`,
        errorObject instanceof Error ? errorObject.message : errorObject
      );
      if (attempt < attempts) {
        await delay(delayMs);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed ${operation}`);
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
