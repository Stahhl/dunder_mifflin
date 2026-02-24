package com.dundermifflin.biingestionservice.domain.service

import com.dundermifflin.biingestionservice.domain.model.DomainEventEnvelope
import com.dundermifflin.biingestionservice.domain.port.input.BiEventIngestionUseCase
import com.dundermifflin.biingestionservice.domain.port.output.BiWarehousePort
import com.dundermifflin.biingestionservice.domain.port.output.RawObjectStorePort
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import jakarta.annotation.PostConstruct
import java.time.Instant

private const val ORDER_CREATED_EVENT_TYPE = "com.dundermifflin.order.created.v1"
private const val SHIPMENT_DISPATCHED_EVENT_TYPE = "com.dundermifflin.shipment.dispatched.v1"
private const val EXPENSE_DECIDED_EVENT_TYPE = "com.dundermifflin.expense.decided.v1"

@Service
class BiEventIngestionService(
    private val objectMapper: ObjectMapper,
    private val biWarehousePort: BiWarehousePort,
    private val rawObjectStorePort: RawObjectStorePort
) : BiEventIngestionUseCase {
    private val logger = LoggerFactory.getLogger(BiEventIngestionService::class.java)

    @PostConstruct
    fun initialize() {
        biWarehousePort.initializeSchema()
    }

    override fun ingest(rawPayload: String, routingKey: String) {
        val root = try {
            objectMapper.readTree(rawPayload)
        } catch (exception: Exception) {
            logger.warn("Skipping unparsable domain event", exception)
            return
        }

        val envelope = parseEnvelope(root) ?: return

        rawObjectStorePort.storeRawEventIfMissing(envelope, rawPayload)
        biWarehousePort.upsertRawEvent(envelope, routingKey, rawPayload)

        when (envelope.eventType) {
            ORDER_CREATED_EVENT_TYPE -> biWarehousePort.upsertOrderFact(envelope)
            SHIPMENT_DISPATCHED_EVENT_TYPE -> biWarehousePort.upsertShipmentFact(envelope)
            EXPENSE_DECIDED_EVENT_TYPE -> biWarehousePort.upsertExpenseFact(envelope)
            else -> logger.debug("Skipping unsupported BI event type: {}", envelope.eventType)
        }
    }

    private fun parseEnvelope(root: JsonNode): DomainEventEnvelope? {
        val eventId = root.path("id").asText("").trim()
        val eventType = root.path("type").asText("").trim()

        if (eventId.isBlank() || eventType.isBlank()) {
            logger.debug("Skipping event missing id or type")
            return null
        }

        val occurredAt = parseInstant(root.path("time").asText(""))
        val source = root.path("source").asText("").trim()
        val subject = root.path("subject").asText("").trim()
        val specVersion = root.path("specversion").asText("1.0").trim().ifBlank { "1.0" }
        val schemaVersion = extractSchemaVersion(eventType)
        val data = root.path("data")

        if (data.isMissingNode || data.isNull) {
            logger.debug("Skipping event without data payload: {}", eventType)
            return null
        }

        return DomainEventEnvelope(
            specVersion = specVersion,
            eventId = eventId,
            eventType = eventType,
            source = source,
            subject = subject,
            occurredAt = occurredAt,
            schemaVersion = schemaVersion,
            data = data
        )
    }

    private fun parseInstant(raw: String): Instant {
        return try {
            Instant.parse(raw)
        } catch (_: Exception) {
            Instant.now()
        }
    }

    private fun extractSchemaVersion(eventType: String): Int {
        val markerIndex = eventType.lastIndexOf(".v")
        if (markerIndex == -1 || markerIndex == eventType.lastIndex) {
            return 1
        }

        return eventType.substring(markerIndex + 2).toIntOrNull() ?: 1
    }
}
