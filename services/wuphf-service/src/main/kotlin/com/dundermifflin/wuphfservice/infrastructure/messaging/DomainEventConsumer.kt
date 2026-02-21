package com.dundermifflin.wuphfservice.infrastructure.messaging

import com.dundermifflin.wuphfservice.domain.model.CreateNotificationCommand
import com.dundermifflin.wuphfservice.domain.model.NotificationKind
import com.dundermifflin.wuphfservice.domain.port.input.NotificationUseCase
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.amqp.rabbit.annotation.RabbitListener
import org.springframework.stereotype.Component
import java.time.Instant

private const val ORDER_CREATED_EVENT_TYPE = "com.dundermifflin.order.created.v1"
private const val SHIPMENT_DISPATCHED_EVENT_TYPE = "com.dundermifflin.shipment.dispatched.v1"
private const val EXPENSE_DECIDED_EVENT_TYPE = "com.dundermifflin.expense.decided.v1"

@Component
class DomainEventConsumer(
    private val objectMapper: ObjectMapper,
    private val notificationUseCase: NotificationUseCase
) {
    private val logger = LoggerFactory.getLogger(DomainEventConsumer::class.java)

    @RabbitListener(queues = ["\${wuphf.messaging.queue}"])
    fun consume(rawPayload: String) {
        val root = try {
            objectMapper.readTree(rawPayload)
        } catch (exception: Exception) {
            logger.warn("Ignoring unparsable domain event payload", exception)
            return
        }

        val eventType = root.path("type").asText("").trim()
        if (eventType.isBlank()) {
            logger.debug("Skipping event without type")
            return
        }

        val eventId = root.path("id").asText("").trim().ifBlank { null }
        val eventTime = parseInstant(root.path("time").asText(""))
        val data = root.path("data")

        when (eventType) {
            ORDER_CREATED_EVENT_TYPE -> handleOrderCreated(data, eventId, eventTime)
            SHIPMENT_DISPATCHED_EVENT_TYPE -> handleShipmentDispatched(data, eventId, eventTime)
            EXPENSE_DECIDED_EVENT_TYPE -> handleExpenseDecided(data, eventId, eventTime)
            else -> logger.debug("Skipping unsupported event type: {}", eventType)
        }
    }

    private fun handleOrderCreated(data: JsonNode, eventId: String?, eventTime: Instant) {
        val userId = data.path("createdBy").asText("").trim()
        val orderId = data.path("orderId").asText("").trim()
        val clientId = data.path("clientId").asText("").trim()

        if (userId.isBlank() || orderId.isBlank()) {
            return
        }

        notificationUseCase.createNotification(
            CreateNotificationCommand(
                userId = userId,
                kind = NotificationKind.ORDER_PLACED,
                title = "Order $orderId created",
                body = if (clientId.isNotBlank()) {
                    "Order for $clientId was placed successfully."
                } else {
                    "Your order was placed successfully."
                },
                deepLink = "/infinity?orderId=$orderId",
                sourceEventId = eventId,
                createdAt = eventTime
            )
        )
    }

    private fun handleShipmentDispatched(data: JsonNode, eventId: String?, eventTime: Instant) {
        val orderOwner = data.path("orderCreatedBy").asText("").trim()
        val orderId = data.path("orderId").asText("").trim()
        val shipmentId = data.path("shipmentId").asText("").trim()
        val truckId = data.path("truckId").asText("").trim()

        if (orderOwner.isBlank() || orderId.isBlank() || shipmentId.isBlank()) {
            return
        }

        val body = if (truckId.isNotBlank()) {
            "Shipment $shipmentId left the warehouse on truck $truckId."
        } else {
            "Shipment $shipmentId left the warehouse."
        }

        notificationUseCase.createNotification(
            CreateNotificationCommand(
                userId = orderOwner,
                kind = NotificationKind.SHIPMENT_DISPATCHED,
                title = "Order $orderId shipped",
                body = body,
                deepLink = "/infinity?orderId=$orderId",
                sourceEventId = eventId,
                createdAt = eventTime
            )
        )
    }

    private fun handleExpenseDecided(data: JsonNode, eventId: String?, eventTime: Instant) {
        val submitterUserId = data.path("submitterUserId").asText("").trim()
        val expenseId = data.path("expenseId").asText("").trim()
        val decision = data.path("decision").asText("").trim()
        val decidedBy = data.path("decidedBy").asText("").trim()

        if (submitterUserId.isBlank() || expenseId.isBlank() || decision.isBlank()) {
            return
        }

        val body = if (decidedBy.isNotBlank()) {
            "Expense $expenseId was marked $decision by $decidedBy."
        } else {
            "Expense $expenseId was marked $decision."
        }

        notificationUseCase.createNotification(
            CreateNotificationCommand(
                userId = submitterUserId,
                kind = NotificationKind.EXPENSE_DECIDED,
                title = "Expense $expenseId $decision",
                body = body,
                deepLink = "/accounting?expenseId=$expenseId",
                sourceEventId = eventId,
                createdAt = eventTime
            )
        )
    }

    private fun parseInstant(value: String): Instant {
        return try {
            Instant.parse(value)
        } catch (_: Exception) {
            Instant.now()
        }
    }
}
