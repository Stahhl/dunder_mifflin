import { randomUUID } from "node:crypto";
import amqp from "amqplib";

const ORDER_CREATED_EVENT_TYPE = "com.dundermifflin.order.created.v1";
const ORDER_CREATED_ROUTING_KEY = "order.created.v1";

export class RabbitDomainEventPublisher {
  constructor({ amqpUrl, exchange, source = "/order-service", logger = console }) {
    this.amqpUrl = amqpUrl;
    this.exchange = exchange;
    this.source = source;
    this.logger = logger;
    this.connection = null;
    this.channel = null;
  }

  async connect() {
    this.connection = await amqp.connect(this.amqpUrl);
    this.channel = await this.connection.createConfirmChannel();
    await this.channel.assertExchange(this.exchange, "topic", { durable: true });

    this.connection.on("error", (errorObject) => {
      this.logger.error("RabbitMQ connection error in order-service", errorObject);
    });

    this.connection.on("close", () => {
      this.channel = null;
      this.connection = null;
    });
  }

  isHealthy() {
    return Boolean(this.connection && this.channel);
  }

  async publishOrderCreated(order) {
    if (!this.channel) {
      throw new Error("RabbitMQ channel is not connected");
    }

    const cloudEvent = buildOrderCreatedCloudEvent(order, this.source);
    const payload = Buffer.from(JSON.stringify(cloudEvent), "utf8");

    await publishConfirmed(this.channel, this.exchange, ORDER_CREATED_ROUTING_KEY, payload, {
      contentType: "application/cloudevents+json",
      deliveryMode: 2,
      messageId: cloudEvent.id,
      type: cloudEvent.type
    });

    return cloudEvent;
  }

  async close() {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
    this.channel = null;
    this.connection = null;
  }
}

export function buildOrderCreatedCloudEvent(order, source = "/order-service") {
  const timestamp = order.createdAt ?? new Date().toISOString();

  return {
    specversion: "1.0",
    id: `evt_${randomUUID().replaceAll("-", "")}`,
    type: ORDER_CREATED_EVENT_TYPE,
    source,
    subject: `order/${order.orderId}`,
    time: timestamp,
    datacontenttype: "application/json",
    data: {
      orderId: order.orderId,
      clientId: order.clientId,
      items: order.items,
      createdBy: order.createdBy,
      createdAt: timestamp
    }
  };
}

async function publishConfirmed(channel, exchange, routingKey, payload, options) {
  await new Promise((resolve, reject) => {
    channel.publish(exchange, routingKey, payload, options, (errorObject) => {
      if (errorObject) {
        reject(errorObject);
        return;
      }
      resolve();
    });
  });
}
