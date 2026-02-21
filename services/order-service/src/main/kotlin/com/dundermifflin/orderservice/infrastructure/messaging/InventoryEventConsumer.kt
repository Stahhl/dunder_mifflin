package com.dundermifflin.orderservice.infrastructure.messaging

import com.dundermifflin.orderservice.domain.model.ApplyShipmentDispatchedCommand
import com.dundermifflin.orderservice.domain.port.input.OrderUseCase
import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.amqp.rabbit.annotation.RabbitListener
import org.springframework.stereotype.Component
import java.time.Instant

private const val SHIPMENT_DISPATCHED_EVENT_TYPE = "com.dundermifflin.shipment.dispatched.v1"

@Component
class InventoryEventConsumer(
    private val objectMapper: ObjectMapper,
    private val orderUseCase: OrderUseCase
) {
    private val logger = LoggerFactory.getLogger(InventoryEventConsumer::class.java)

    @RabbitListener(queues = ["\${order.inventory-events-queue}"])
    fun consume(rawPayload: String) {
        val root = try {
            objectMapper.readTree(rawPayload)
        } catch (exception: Exception) {
            logger.warn("Ignoring unparsable inventory event payload", exception)
            return
        }

        val eventType = root.path("type").asText("").trim()
        if (eventType != SHIPMENT_DISPATCHED_EVENT_TYPE) {
            return
        }

        val data = root.path("data")
        val shipmentId = data.path("shipmentId").asText("").trim()
        val orderId = data.path("orderId").asText("").trim()
        if (shipmentId.isBlank() || orderId.isBlank()) {
            return
        }

        val dispatchedAt = parseInstant(data.path("dispatchedAt").asText(""), root.path("time").asText(""))

        orderUseCase.applyShipmentDispatched(
            ApplyShipmentDispatchedCommand(
                shipmentId = shipmentId,
                orderId = orderId,
                dispatchedAt = dispatchedAt
            )
        )
    }

    private fun parseInstant(primary: String, fallback: String): Instant {
        return try {
            Instant.parse(primary)
        } catch (_: Exception) {
            try {
                Instant.parse(fallback)
            } catch (_: Exception) {
                Instant.now()
            }
        }
    }
}
