package com.dundermifflin.inventoryservice.infrastructure.persistence

import com.dundermifflin.inventoryservice.domain.model.DispatchShipmentCommand
import com.dundermifflin.inventoryservice.domain.model.DispatchShipmentResult
import com.dundermifflin.inventoryservice.domain.model.OrderCreatedEvent
import com.dundermifflin.inventoryservice.domain.model.RecordScanCommand
import com.dundermifflin.inventoryservice.domain.model.ScanShipmentResult
import com.dundermifflin.inventoryservice.domain.model.ShipmentItem
import com.dundermifflin.inventoryservice.domain.model.ShipmentStatus
import com.dundermifflin.inventoryservice.domain.model.ShipmentSummary
import com.dundermifflin.inventoryservice.domain.port.output.InventoryRepositoryPort
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.dao.DuplicateKeyException
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.core.RowMapper
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.sql.ResultSet
import java.sql.Timestamp
import java.time.Instant

private const val SCAN_OPERATION = "SCAN"
private const val DISPATCH_OPERATION = "DISPATCH"
private const val ORDER_STATUS_SHIPPED = "SHIPPED"

@Component
class JdbcInventoryRepositoryAdapter(
    private val jdbcTemplate: JdbcTemplate,
    private val objectMapper: ObjectMapper
) : InventoryRepositoryPort {

    @Transactional
    override fun upsertShipmentFromOrderCreated(event: OrderCreatedEvent) {
        val shipmentId = orderIdToShipmentId(event.orderId)
        val itemsJson = objectMapper.writeValueAsString(event.items)

        try {
            jdbcTemplate.update(
                """
                INSERT INTO inventory.shipments (
                  shipment_id,
                  order_id,
                  client_id,
                  requested_ship_date,
                  items,
                  status,
                  created_at,
                  created_by,
                  updated_at
                ) VALUES (?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?)
                """.trimIndent(),
                shipmentId,
                event.orderId,
                event.clientId,
                event.requestedShipDate,
                itemsJson,
                ShipmentStatus.PENDING.name,
                Timestamp.from(event.createdAt),
                event.createdBy,
                Timestamp.from(event.createdAt)
            )
        } catch (_: DuplicateKeyException) {
            // Duplicate order.created events are expected during replay.
        }
    }

    override fun listShipments(status: String?): List<ShipmentSummary> {
        return if (status.equals("PENDING", ignoreCase = true)) {
            jdbcTemplate.query(
                """
                SELECT shipment_id, order_id, client_id, requested_ship_date, items, status, created_at, created_by,
                       dispatched_at, dispatched_by, truck_id
                FROM inventory.shipments
                WHERE status IN ('PENDING', 'LOADING')
                ORDER BY created_at ASC
                """.trimIndent(),
                shipmentRowMapper
            )
        } else {
            jdbcTemplate.query(
                """
                SELECT shipment_id, order_id, client_id, requested_ship_date, items, status, created_at, created_by,
                       dispatched_at, dispatched_by, truck_id
                FROM inventory.shipments
                ORDER BY created_at ASC
                """.trimIndent(),
                shipmentRowMapper
            )
        }
    }

    @Transactional
    override fun recordScan(command: RecordScanCommand): ScanShipmentResult? {
        command.idempotencyKey?.let { key ->
            readIdempotencyRecord(SCAN_OPERATION, key)?.let { payload ->
                return parseScanResult(payload)
            }
        }

        val shipment = findShipment(command.shipmentId) ?: return null
        if (shipment.status == ShipmentStatus.DISPATCHED) {
            return null
        }

        val scanResult = ScanShipmentResult(
            shipmentId = shipment.shipmentId,
            orderId = shipment.orderId,
            status = if (shipment.status == ShipmentStatus.PENDING) ShipmentStatus.LOADING else shipment.status,
            barcode = command.barcode,
            quantity = command.quantity,
            scannedBy = command.scannedBy,
            scannedAt = command.scannedAt
        )

        jdbcTemplate.update(
            """
            INSERT INTO inventory.shipment_scan_log (
              shipment_id,
              barcode,
              quantity,
              scanned_by,
              scanned_at,
              idempotency_key
            ) VALUES (?, ?, ?, ?, ?, ?)
            """.trimIndent(),
            command.shipmentId,
            command.barcode,
            command.quantity,
            command.scannedBy,
            Timestamp.from(command.scannedAt),
            command.idempotencyKey
        )

        jdbcTemplate.update(
            """
            UPDATE inventory.shipments
            SET status = ?, updated_at = ?
            WHERE shipment_id = ?
            """.trimIndent(),
            scanResult.status.name,
            Timestamp.from(command.scannedAt),
            command.shipmentId
        )

        command.idempotencyKey?.let { key ->
            saveIdempotencyRecord(SCAN_OPERATION, key, command.shipmentId, objectMapper.writeValueAsString(scanResult))
        }

        return scanResult
    }

    @Transactional
    override fun dispatchShipment(command: DispatchShipmentCommand): DispatchShipmentResult? {
        readIdempotencyRecord(DISPATCH_OPERATION, command.idempotencyKey)?.let { payload ->
            return parseDispatchResult(payload)
        }

        val shipment = findShipment(command.shipmentId) ?: return null

        val result = if (shipment.status == ShipmentStatus.DISPATCHED) {
            DispatchShipmentResult(
                shipmentId = shipment.shipmentId,
                orderId = shipment.orderId,
                orderCreatedBy = shipment.createdBy,
                shipmentStatus = ShipmentStatus.DISPATCHED,
                orderStatus = ORDER_STATUS_SHIPPED,
                dispatchedAt = shipment.dispatchedAt ?: command.dispatchedAt,
                dispatchedBy = shipment.dispatchedBy ?: command.dispatchedBy,
                truckId = shipment.truckId ?: command.truckId,
                alreadyDispatched = true
            )
        } else {
            jdbcTemplate.update(
                """
                UPDATE inventory.shipments
                SET status = ?, dispatched_at = ?, dispatched_by = ?, truck_id = ?, updated_at = ?
                WHERE shipment_id = ?
                """.trimIndent(),
                ShipmentStatus.DISPATCHED.name,
                Timestamp.from(command.dispatchedAt),
                command.dispatchedBy,
                command.truckId,
                Timestamp.from(command.dispatchedAt),
                command.shipmentId
            )

            DispatchShipmentResult(
                shipmentId = shipment.shipmentId,
                orderId = shipment.orderId,
                orderCreatedBy = shipment.createdBy,
                shipmentStatus = ShipmentStatus.DISPATCHED,
                orderStatus = ORDER_STATUS_SHIPPED,
                dispatchedAt = command.dispatchedAt,
                dispatchedBy = command.dispatchedBy,
                truckId = command.truckId,
                alreadyDispatched = false
            )
        }

        saveIdempotencyRecord(
            DISPATCH_OPERATION,
            command.idempotencyKey,
            command.shipmentId,
            objectMapper.writeValueAsString(result)
        )

        return result
    }

    private fun findShipment(shipmentId: String): ShipmentSummary? {
        val rows = jdbcTemplate.query(
            """
            SELECT shipment_id, order_id, client_id, requested_ship_date, items, status, created_at, created_by,
                   dispatched_at, dispatched_by, truck_id
            FROM inventory.shipments
            WHERE shipment_id = ?
            """.trimIndent(),
            shipmentRowMapper,
            shipmentId
        )

        return rows.firstOrNull()
    }

    private fun readIdempotencyRecord(operationType: String, idempotencyKey: String): String? {
        val rows = jdbcTemplate.query(
            """
            SELECT response_json
            FROM inventory.idempotency_records
            WHERE operation_type = ? AND idempotency_key = ?
            """.trimIndent(),
            { rs, _ -> rs.getString("response_json") },
            operationType,
            idempotencyKey
        )

        return rows.firstOrNull()
    }

    private fun saveIdempotencyRecord(
        operationType: String,
        idempotencyKey: String,
        shipmentId: String,
        responseJson: String
    ) {
        try {
            jdbcTemplate.update(
                """
                INSERT INTO inventory.idempotency_records (
                  operation_type,
                  idempotency_key,
                  shipment_id,
                  response_json,
                  created_at
                ) VALUES (?, ?, ?, ?::jsonb, ?)
                """.trimIndent(),
                operationType,
                idempotencyKey,
                shipmentId,
                responseJson,
                Timestamp.from(Instant.now())
            )
        } catch (_: DuplicateKeyException) {
            // Idempotent replay races are expected.
        }
    }

    private fun parseScanResult(payload: String): ScanShipmentResult {
        val node = objectMapper.readTree(payload)
        return ScanShipmentResult(
            shipmentId = node.path("shipmentId").asText(),
            orderId = node.path("orderId").asText(),
            status = ShipmentStatus.valueOf(node.path("status").asText(ShipmentStatus.LOADING.name)),
            barcode = node.path("barcode").asText(),
            quantity = node.path("quantity").asInt(),
            scannedBy = node.path("scannedBy").asText(),
            scannedAt = Instant.parse(node.path("scannedAt").asText())
        )
    }

    private fun parseDispatchResult(payload: String): DispatchShipmentResult {
        val node = objectMapper.readTree(payload)
        return DispatchShipmentResult(
            shipmentId = node.path("shipmentId").asText(),
            orderId = node.path("orderId").asText(),
            orderCreatedBy = node.path("orderCreatedBy").asText(),
            shipmentStatus = ShipmentStatus.valueOf(node.path("shipmentStatus").asText(ShipmentStatus.DISPATCHED.name)),
            orderStatus = node.path("orderStatus").asText(ORDER_STATUS_SHIPPED),
            dispatchedAt = Instant.parse(node.path("dispatchedAt").asText()),
            dispatchedBy = node.path("dispatchedBy").asText(),
            truckId = node.path("truckId").asText(),
            alreadyDispatched = node.path("alreadyDispatched").asBoolean(false)
        )
    }

    private val shipmentRowMapper = RowMapper { rs: ResultSet, _: Int ->
        ShipmentSummary(
            shipmentId = rs.getString("shipment_id"),
            orderId = rs.getString("order_id"),
            clientId = rs.getString("client_id"),
            requestedShipDate = rs.getDate("requested_ship_date").toLocalDate(),
            status = ShipmentStatus.valueOf(rs.getString("status")),
            items = parseItems(rs.getString("items")),
            createdAt = rs.getTimestamp("created_at").toInstant(),
            createdBy = rs.getString("created_by"),
            dispatchedAt = rs.getTimestamp("dispatched_at")?.toInstant(),
            dispatchedBy = rs.getString("dispatched_by"),
            truckId = rs.getString("truck_id")
        )
    }

    private fun parseItems(value: String?): List<ShipmentItem> {
        if (value.isNullOrBlank()) {
            return emptyList()
        }

        return try {
            val tree = objectMapper.readTree(value)
            if (!tree.isArray) {
                return emptyList()
            }

            tree.mapNotNull { node: JsonNode ->
                val sku = node.path("sku").asText("").trim()
                val quantity = node.path("quantity").asInt(0)
                if (sku.isBlank() || quantity <= 0) {
                    null
                } else {
                    ShipmentItem(sku = sku, quantity = quantity)
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun orderIdToShipmentId(orderId: String): String {
        return if (orderId.startsWith("ord_")) {
            "ship_${orderId.removePrefix("ord_")}"
        } else {
            "ship_$orderId"
        }
    }
}
