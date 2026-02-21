package com.dundermifflin.inventoryservice.infrastructure.messaging

import com.dundermifflin.inventoryservice.domain.model.DispatchShipmentResult
import com.dundermifflin.inventoryservice.domain.port.output.ShipmentEventPublisherPort
import com.dundermifflin.inventoryservice.infrastructure.config.InventoryMessagingProperties
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.amqp.core.MessageDeliveryMode
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.stereotype.Component
import java.util.UUID

private const val SHIPMENT_DISPATCHED_EVENT_TYPE = "com.dundermifflin.shipment.dispatched.v1"
private const val SHIPMENT_DISPATCHED_ROUTING_KEY = "shipment.dispatched.v1"

@Component
class RabbitShipmentEventPublisher(
    private val rabbitTemplate: RabbitTemplate,
    private val objectMapper: ObjectMapper,
    private val inventoryMessagingProperties: InventoryMessagingProperties
) : ShipmentEventPublisherPort {
    override fun publishShipmentDispatched(result: DispatchShipmentResult) {
        val eventId = "evt_${UUID.randomUUID().toString().replace("-", "")}";

        val payload = mapOf(
            "specversion" to "1.0",
            "id" to eventId,
            "type" to SHIPMENT_DISPATCHED_EVENT_TYPE,
            "source" to "/inventory-service",
            "subject" to "shipment/${result.shipmentId}",
            "time" to result.dispatchedAt.toString(),
            "datacontenttype" to "application/json",
            "data" to mapOf(
                "shipmentId" to result.shipmentId,
                "orderId" to result.orderId,
                "orderCreatedBy" to result.orderCreatedBy,
                "dispatchedBy" to result.dispatchedBy,
                "truckId" to result.truckId,
                "dispatchedAt" to result.dispatchedAt.toString()
            )
        )

        val body = objectMapper.writeValueAsString(payload)
        rabbitTemplate.convertAndSend(inventoryMessagingProperties.exchange, SHIPMENT_DISPATCHED_ROUTING_KEY, body) { message ->
            message.messageProperties.contentType = "application/cloudevents+json"
            message.messageProperties.deliveryMode = MessageDeliveryMode.PERSISTENT
            message.messageProperties.messageId = eventId
            message.messageProperties.type = SHIPMENT_DISPATCHED_EVENT_TYPE
            message
        }
    }
}
