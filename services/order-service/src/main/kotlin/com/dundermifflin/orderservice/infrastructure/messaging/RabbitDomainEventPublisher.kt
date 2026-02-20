package com.dundermifflin.orderservice.infrastructure.messaging

import com.dundermifflin.orderservice.domain.model.Order
import com.dundermifflin.orderservice.domain.port.output.DomainEventPublisherPort
import com.dundermifflin.orderservice.infrastructure.config.OrderMessagingProperties
import org.springframework.amqp.core.MessageDeliveryMode
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.stereotype.Component
import java.util.UUID

private const val ORDER_CREATED_EVENT_TYPE = "com.dundermifflin.order.created.v1"
private const val ORDER_CREATED_ROUTING_KEY = "order.created.v1"

@Component
class RabbitDomainEventPublisher(
    private val rabbitTemplate: RabbitTemplate,
    private val orderMessagingProperties: OrderMessagingProperties
) : DomainEventPublisherPort {
    override fun publishOrderCreated(order: Order) {
        val eventId = "evt_${UUID.randomUUID().toString().replace("-", "")}"
        val occurredAt = order.createdAt

        val payload = mapOf(
            "specversion" to "1.0",
            "id" to eventId,
            "type" to ORDER_CREATED_EVENT_TYPE,
            "source" to "/order-service",
            "subject" to "order/${order.orderId}",
            "time" to occurredAt.toString(),
            "datacontenttype" to "application/json",
            "data" to mapOf(
                "orderId" to order.orderId,
                "clientId" to order.clientId,
                "items" to order.items,
                "createdBy" to order.createdBy,
                "createdAt" to occurredAt.toString()
            )
        )

        rabbitTemplate.convertAndSend(orderMessagingProperties.exchange, ORDER_CREATED_ROUTING_KEY, payload) { message ->
            message.messageProperties.contentType = "application/cloudevents+json"
            message.messageProperties.deliveryMode = MessageDeliveryMode.PERSISTENT
            message.messageProperties.messageId = eventId
            message.messageProperties.type = ORDER_CREATED_EVENT_TYPE
            message
        }
    }

    override fun isHealthy(): Boolean = try {
        rabbitTemplate.execute<Boolean> { channel -> channel.isOpen } ?: false
    } catch (_: Exception) {
        false
    }
}
