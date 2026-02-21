package com.dundermifflin.inventoryservice.infrastructure.messaging

import com.dundermifflin.inventoryservice.domain.model.OrderCreatedEvent
import com.dundermifflin.inventoryservice.domain.model.ShipmentItem
import com.dundermifflin.inventoryservice.domain.port.input.InventoryUseCase
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.amqp.rabbit.annotation.RabbitListener
import org.springframework.stereotype.Component
import java.time.Instant
import java.time.LocalDate

private const val ORDER_CREATED_EVENT_TYPE = "com.dundermifflin.order.created.v1"

@Component
class DomainEventConsumer(
    private val objectMapper: ObjectMapper,
    private val inventoryUseCase: InventoryUseCase
) {
    private val logger = LoggerFactory.getLogger(DomainEventConsumer::class.java)

    @RabbitListener(queues = ["\${inventory.messaging.order-events-queue}"])
    fun consume(rawPayload: String) {
        val root = try {
            objectMapper.readTree(rawPayload)
        } catch (exception: Exception) {
            logger.warn("Ignoring unparsable domain event payload", exception)
            return
        }

        val eventType = root.path("type").asText("").trim()
        if (eventType != ORDER_CREATED_EVENT_TYPE) {
            return
        }

        val data = root.path("data")
        val orderId = data.path("orderId").asText("").trim()
        val clientId = data.path("clientId").asText("").trim()
        val createdBy = data.path("createdBy").asText("").trim()
        if (orderId.isBlank() || clientId.isBlank() || createdBy.isBlank()) {
            return
        }

        val createdAt = parseInstant(
            primary = data.path("createdAt").asText(""),
            fallback = root.path("time").asText("")
        )
        val requestedShipDate = parseShipDate(data.path("requestedShipDate").asText(""), createdAt)

        val items = parseItems(data.path("items"))
        if (items.isEmpty()) {
            return
        }

        inventoryUseCase.registerOrderCreated(
            OrderCreatedEvent(
                eventId = root.path("id").asText("").trim().ifBlank { null },
                orderId = orderId,
                clientId = clientId,
                createdBy = createdBy,
                createdAt = createdAt,
                requestedShipDate = requestedShipDate,
                items = items
            )
        )
    }

    private fun parseItems(itemsNode: JsonNode): List<ShipmentItem> {
        if (!itemsNode.isArray) {
            return emptyList()
        }

        return itemsNode.mapNotNull { node ->
            val sku = node.path("sku").asText("").trim()
            val quantity = node.path("quantity").asInt(0)
            if (sku.isBlank() || quantity <= 0) {
                null
            } else {
                ShipmentItem(sku = sku, quantity = quantity)
            }
        }
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

    private fun parseShipDate(value: String, fallbackInstant: Instant): LocalDate {
        return try {
            LocalDate.parse(value)
        } catch (_: Exception) {
            fallbackInstant.atZone(java.time.ZoneOffset.UTC).toLocalDate()
        }
    }
}
