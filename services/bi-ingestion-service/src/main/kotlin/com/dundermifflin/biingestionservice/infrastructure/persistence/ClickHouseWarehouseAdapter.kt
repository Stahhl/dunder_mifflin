package com.dundermifflin.biingestionservice.infrastructure.persistence

import com.dundermifflin.biingestionservice.domain.model.DomainEventEnvelope
import com.dundermifflin.biingestionservice.domain.port.output.BiWarehousePort
import com.dundermifflin.biingestionservice.infrastructure.config.BiStorageProperties
import org.slf4j.LoggerFactory
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component
import java.sql.Date
import java.sql.Timestamp
import java.time.Instant
import java.time.LocalDate

@Component
class ClickHouseWarehouseAdapter(
    private val jdbcTemplate: JdbcTemplate,
    private val biStorageProperties: BiStorageProperties
) : BiWarehousePort {
    private val logger = LoggerFactory.getLogger(ClickHouseWarehouseAdapter::class.java)
    private val database = biStorageProperties.clickhouse.database

    override fun initializeSchema() {
        jdbcTemplate.execute("CREATE DATABASE IF NOT EXISTS $database")

        jdbcTemplate.execute(
            """
            CREATE TABLE IF NOT EXISTS $database.raw_domain_events (
              event_id String,
              event_type LowCardinality(String),
              routing_key LowCardinality(String),
              source String,
              subject Nullable(String),
              occurred_at DateTime64(3, 'UTC'),
              ingested_at DateTime64(3, 'UTC'),
              payload_json String,
              schema_version UInt16,
              producer_service LowCardinality(String)
            )
            ENGINE = ReplacingMergeTree(ingested_at)
            ORDER BY (event_id)
            """.trimIndent()
        )

        jdbcTemplate.execute(
            """
            CREATE TABLE IF NOT EXISTS $database.fact_orders (
              event_id String,
              order_id String,
              client_id Nullable(String),
              created_by Nullable(String),
              requested_ship_date Nullable(Date),
              item_count UInt32,
              total_quantity UInt32,
              occurred_at DateTime64(3, 'UTC'),
              ingested_at DateTime64(3, 'UTC')
            )
            ENGINE = ReplacingMergeTree(ingested_at)
            ORDER BY (order_id, event_id)
            """.trimIndent()
        )

        jdbcTemplate.execute(
            """
            CREATE TABLE IF NOT EXISTS $database.fact_shipments (
              event_id String,
              shipment_id String,
              order_id String,
              order_created_by Nullable(String),
              dispatched_by Nullable(String),
              truck_id Nullable(String),
              occurred_at DateTime64(3, 'UTC'),
              ingested_at DateTime64(3, 'UTC')
            )
            ENGINE = ReplacingMergeTree(ingested_at)
            ORDER BY (shipment_id, event_id)
            """.trimIndent()
        )

        jdbcTemplate.execute(
            """
            CREATE TABLE IF NOT EXISTS $database.fact_expenses (
              event_id String,
              expense_id String,
              submitter_user_id Nullable(String),
              decision Nullable(String),
              decided_by Nullable(String),
              comment Nullable(String),
              occurred_at DateTime64(3, 'UTC'),
              ingested_at DateTime64(3, 'UTC')
            )
            ENGINE = ReplacingMergeTree(ingested_at)
            ORDER BY (expense_id, event_id)
            """.trimIndent()
        )

        configureBiReaderUser()
    }

    override fun upsertRawEvent(event: DomainEventEnvelope, routingKey: String, rawPayload: String) {
        if (recordExists("raw_domain_events", event.eventId)) {
            return
        }

        jdbcTemplate.update(
            """
            INSERT INTO $database.raw_domain_events (
              event_id,
              event_type,
              routing_key,
              source,
              subject,
              occurred_at,
              ingested_at,
              payload_json,
              schema_version,
              producer_service
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """.trimIndent(),
            event.eventId,
            event.eventType,
            routingKey,
            event.source,
            event.subject.ifBlank { null },
            Timestamp.from(event.occurredAt),
            Timestamp.from(Instant.now()),
            rawPayload,
            event.schemaVersion,
            event.source.removePrefix("/").ifBlank { "unknown" }
        )
    }

    override fun upsertOrderFact(event: DomainEventEnvelope) {
        if (recordExists("fact_orders", event.eventId)) {
            return
        }

        val data = event.data
        val orderId = data.path("orderId").asText("").trim()
        if (orderId.isBlank()) {
            return
        }

        val items = data.path("items")
        var itemCount = 0
        var totalQuantity = 0L

        if (items.isArray) {
            itemCount = items.size()
            items.forEach { item ->
                totalQuantity += item.path("quantity").asLong(0L)
            }
        }

        val requestedShipDate = parseLocalDate(data.path("requestedShipDate").asText(""))

        jdbcTemplate.update(
            """
            INSERT INTO $database.fact_orders (
              event_id,
              order_id,
              client_id,
              created_by,
              requested_ship_date,
              item_count,
              total_quantity,
              occurred_at,
              ingested_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """.trimIndent(),
            event.eventId,
            orderId,
            data.path("clientId").asText("").trim().ifBlank { null },
            data.path("createdBy").asText("").trim().ifBlank { null },
            requestedShipDate?.let { Date.valueOf(it) },
            itemCount,
            totalQuantity,
            Timestamp.from(event.occurredAt),
            Timestamp.from(Instant.now())
        )
    }

    override fun upsertShipmentFact(event: DomainEventEnvelope) {
        if (recordExists("fact_shipments", event.eventId)) {
            return
        }

        val data = event.data
        val shipmentId = data.path("shipmentId").asText("").trim()
        val orderId = data.path("orderId").asText("").trim()

        if (shipmentId.isBlank() || orderId.isBlank()) {
            return
        }

        jdbcTemplate.update(
            """
            INSERT INTO $database.fact_shipments (
              event_id,
              shipment_id,
              order_id,
              order_created_by,
              dispatched_by,
              truck_id,
              occurred_at,
              ingested_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """.trimIndent(),
            event.eventId,
            shipmentId,
            orderId,
            data.path("orderCreatedBy").asText("").trim().ifBlank { null },
            data.path("dispatchedBy").asText("").trim().ifBlank { null },
            data.path("truckId").asText("").trim().ifBlank { null },
            Timestamp.from(event.occurredAt),
            Timestamp.from(Instant.now())
        )
    }

    override fun upsertExpenseFact(event: DomainEventEnvelope) {
        if (recordExists("fact_expenses", event.eventId)) {
            return
        }

        val data = event.data
        val expenseId = data.path("expenseId").asText("").trim()

        if (expenseId.isBlank()) {
            return
        }

        jdbcTemplate.update(
            """
            INSERT INTO $database.fact_expenses (
              event_id,
              expense_id,
              submitter_user_id,
              decision,
              decided_by,
              comment,
              occurred_at,
              ingested_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """.trimIndent(),
            event.eventId,
            expenseId,
            data.path("submitterUserId").asText("").trim().ifBlank { null },
            data.path("decision").asText("").trim().ifBlank { null },
            data.path("decidedBy").asText("").trim().ifBlank { null },
            data.path("comment").asText("").trim().ifBlank { null },
            Timestamp.from(event.occurredAt),
            Timestamp.from(Instant.now())
        )
    }

    override fun ping(): Boolean = try {
        (jdbcTemplate.queryForObject("SELECT 1", Int::class.java) ?: 0) == 1
    } catch (_: Exception) {
        false
    }

    private fun recordExists(table: String, eventId: String): Boolean {
        val result = jdbcTemplate.queryForObject(
            "SELECT count() FROM $database.$table WHERE event_id = ?",
            Long::class.java,
            eventId
        ) ?: 0L

        return result > 0L
    }

    private fun parseLocalDate(raw: String): LocalDate? {
        if (raw.isBlank()) {
            return null
        }

        return try {
            LocalDate.parse(raw)
        } catch (_: Exception) {
            null
        }
    }

    private fun configureBiReaderUser() {
        val readerUsername = biStorageProperties.clickhouse.readerUsername.trim()
        val readerPassword = biStorageProperties.clickhouse.readerPassword

        if (readerUsername.isBlank()) {
            return
        }

        val escapedPassword = readerPassword.replace("'", "''")
        val escapedReaderUsername = readerUsername.replace("'", "''")

        try {
            jdbcTemplate.execute("CREATE USER IF NOT EXISTS $escapedReaderUsername IDENTIFIED BY '$escapedPassword'")
            jdbcTemplate.execute("GRANT SELECT ON $database.* TO $escapedReaderUsername")
            jdbcTemplate.execute("ALTER USER $escapedReaderUsername SETTINGS readonly = 1")
        } catch (exception: Exception) {
            logger.warn("Unable to ensure ClickHouse BI reader role: {}", exception.message)
        }
    }
}
