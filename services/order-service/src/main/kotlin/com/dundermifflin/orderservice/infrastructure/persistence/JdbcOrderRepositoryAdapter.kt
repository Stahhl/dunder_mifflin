package com.dundermifflin.orderservice.infrastructure.persistence

import com.dundermifflin.orderservice.domain.model.CreateOrderCommand
import com.dundermifflin.orderservice.domain.model.DispatchShipmentResult
import com.dundermifflin.orderservice.domain.model.Order
import com.dundermifflin.orderservice.domain.model.OrderItem
import com.dundermifflin.orderservice.domain.model.OrderStatus
import com.dundermifflin.orderservice.domain.model.OrderSummary
import com.dundermifflin.orderservice.domain.model.OrderTimelineEvent
import com.dundermifflin.orderservice.domain.model.ShipmentWorkItem
import com.dundermifflin.orderservice.domain.port.output.OrderRepositoryPort
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.core.RowMapper
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.sql.ResultSet
import java.sql.Timestamp
import java.time.Instant

@Component
class JdbcOrderRepositoryAdapter(
    private val jdbcTemplate: JdbcTemplate,
    private val objectMapper: ObjectMapper
) : OrderRepositoryPort {
    @Transactional
    override fun createOrder(command: CreateOrderCommand): Order {
        val orderId = jdbcTemplate.queryForObject(
            "SELECT 'ord_' || nextval('orders.order_number_seq') AS order_id",
            String::class.java
        ) ?: throw IllegalStateException("Failed to allocate order id")

        val createdAt = Instant.now()
        val itemsJson = objectMapper.writeValueAsString(command.items)
        val notes = command.notes

        jdbcTemplate.update(
            """
            INSERT INTO orders.orders (
              order_id,
              client_id,
              requested_ship_date,
              items,
              notes,
              created_by,
              status,
              created_at,
              shipment_id
            ) VALUES (?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?)
            """.trimIndent(),
            orderId,
            command.clientId,
            command.requestedShipDate,
            itemsJson,
            notes,
            command.createdBy,
            OrderStatus.CREATED.name,
            Timestamp.from(createdAt),
            null
        )

        jdbcTemplate.update(
            """
            INSERT INTO orders.order_timeline (order_id, status, at, source)
            VALUES (?, ?, ?, ?)
            """.trimIndent(),
            orderId,
            OrderStatus.CREATED.name,
            Timestamp.from(createdAt),
            "order-service"
        )

        return Order(
            orderId = orderId,
            clientId = command.clientId,
            requestedShipDate = command.requestedShipDate,
            items = command.items,
            notes = notes,
            createdBy = command.createdBy,
            status = OrderStatus.CREATED,
            createdAt = createdAt,
            shipmentId = null
        )
    }

    override fun listOrders(clientId: String?): List<OrderSummary> {
        val sql: String
        val args: Array<Any>

        if (clientId.isNullOrBlank()) {
            sql =
                """
                SELECT order_id, client_id, status, requested_ship_date, created_at
                FROM orders.orders
                ORDER BY created_at ASC
                """.trimIndent()
            args = emptyArray()
        } else {
            sql =
                """
                SELECT order_id, client_id, status, requested_ship_date, created_at
                FROM orders.orders
                WHERE client_id = ?
                ORDER BY created_at ASC
                """.trimIndent()
            args = arrayOf(clientId)
        }

        return jdbcTemplate.query(sql, summaryRowMapper, *args)
    }

    override fun getOrderById(orderId: String): Order? {
        val rows = jdbcTemplate.query(
            """
            SELECT
              order_id,
              client_id,
              requested_ship_date,
              items,
              notes,
              created_by,
              status,
              created_at,
              shipment_id
            FROM orders.orders
            WHERE order_id = ?
            """.trimIndent(),
            detailRowMapper,
            orderId
        )

        return rows.firstOrNull()
    }

    override fun getTimeline(orderId: String): List<OrderTimelineEvent> {
        return jdbcTemplate.query(
            """
            SELECT status, at, source
            FROM orders.order_timeline
            WHERE order_id = ?
            ORDER BY at ASC, id ASC
            """.trimIndent(),
            timelineRowMapper,
            orderId
        )
    }

    override fun listPendingShipments(): List<ShipmentWorkItem> {
        return jdbcTemplate.query(
            """
            SELECT
              order_id,
              client_id,
              status,
              requested_ship_date,
              items,
              created_at
            FROM orders.orders
            WHERE status IN ('CREATED', 'RESERVED', 'PICKING')
            ORDER BY created_at ASC
            """.trimIndent(),
            shipmentRowMapper
        )
    }

    override fun getShipmentById(shipmentId: String): ShipmentWorkItem? {
        val orderId = shipmentIdToOrderId(shipmentId) ?: return null

        val rows = jdbcTemplate.query(
            """
            SELECT
              order_id,
              client_id,
              status,
              requested_ship_date,
              items,
              created_at
            FROM orders.orders
            WHERE order_id = ?
            """.trimIndent(),
            shipmentRowMapper,
            orderId
        )

        return rows.firstOrNull()
    }

    @Transactional
    override fun markShipmentDispatched(shipmentId: String, dispatchedAt: Instant): DispatchShipmentResult? {
        val orderId = shipmentIdToOrderId(shipmentId) ?: return null
        val order = getOrderById(orderId) ?: return null

        if (order.status == OrderStatus.SHIPPED) {
            return DispatchShipmentResult(
                shipmentId = shipmentId,
                orderId = orderId,
                orderCreatedBy = order.createdBy,
                shipmentStatus = "DISPATCHED",
                orderStatus = OrderStatus.SHIPPED.name,
                dispatchedAt = dispatchedAt,
                alreadyDispatched = true
            )
        }

        val updatedRows = jdbcTemplate.update(
            """
            UPDATE orders.orders
            SET status = ?, shipment_id = ?
            WHERE order_id = ?
            """.trimIndent(),
            OrderStatus.SHIPPED.name,
            shipmentId,
            orderId
        )

        if (updatedRows == 0) {
            return null
        }

        jdbcTemplate.update(
            """
            INSERT INTO orders.order_timeline (order_id, status, at, source)
            VALUES (?, ?, ?, ?)
            """.trimIndent(),
            orderId,
            OrderStatus.SHIPPED.name,
            Timestamp.from(dispatchedAt),
            "inventory-service"
        )

        return DispatchShipmentResult(
            shipmentId = shipmentId,
            orderId = orderId,
            orderCreatedBy = order.createdBy,
            shipmentStatus = "DISPATCHED",
            orderStatus = OrderStatus.SHIPPED.name,
            dispatchedAt = dispatchedAt,
            alreadyDispatched = false
        )
    }

    @Transactional
    override fun applyShipmentDispatchedEvent(orderId: String, shipmentId: String, dispatchedAt: Instant): Boolean {
        val order = getOrderById(orderId) ?: return false
        if (order.status == OrderStatus.SHIPPED) {
            return true
        }

        val updatedRows = jdbcTemplate.update(
            """
            UPDATE orders.orders
            SET status = ?, shipment_id = ?
            WHERE order_id = ?
            """.trimIndent(),
            OrderStatus.SHIPPED.name,
            shipmentId,
            orderId
        )
        if (updatedRows == 0) {
            return false
        }

        jdbcTemplate.update(
            """
            INSERT INTO orders.order_timeline (order_id, status, at, source)
            VALUES (?, ?, ?, ?)
            """.trimIndent(),
            orderId,
            OrderStatus.SHIPPED.name,
            Timestamp.from(dispatchedAt),
            "inventory-service"
        )

        return true
    }

    override fun isHealthy(): Boolean = try {
        jdbcTemplate.queryForObject("SELECT 1", Int::class.java)
        true
    } catch (_: Exception) {
        false
    }

    private val summaryRowMapper = RowMapper { rs: ResultSet, _: Int ->
        OrderSummary(
            orderId = rs.getString("order_id"),
            clientId = rs.getString("client_id"),
            status = OrderStatus.valueOf(rs.getString("status")),
            requestedShipDate = rs.getDate("requested_ship_date").toLocalDate(),
            createdAt = rs.getTimestamp("created_at").toInstant()
        )
    }

    private val detailRowMapper = RowMapper { rs: ResultSet, _: Int ->
        Order(
            orderId = rs.getString("order_id"),
            clientId = rs.getString("client_id"),
            requestedShipDate = rs.getDate("requested_ship_date").toLocalDate(),
            items = parseItems(rs.getString("items")),
            notes = rs.getString("notes") ?: "",
            createdBy = rs.getString("created_by"),
            status = OrderStatus.valueOf(rs.getString("status")),
            createdAt = rs.getTimestamp("created_at").toInstant(),
            shipmentId = rs.getString("shipment_id")
        )
    }

    private val timelineRowMapper = RowMapper { rs: ResultSet, _: Int ->
        OrderTimelineEvent(
            status = rs.getString("status"),
            at = rs.getTimestamp("at").toInstant(),
            source = rs.getString("source")
        )
    }

    private val shipmentRowMapper = RowMapper { rs: ResultSet, _: Int ->
        val orderId = rs.getString("order_id")
        ShipmentWorkItem(
            shipmentId = orderIdToShipmentId(orderId),
            orderId = orderId,
            clientId = rs.getString("client_id"),
            status = statusToShipmentStatus(rs.getString("status")),
            requestedShipDate = rs.getDate("requested_ship_date").toLocalDate(),
            items = parseItems(rs.getString("items")),
            createdAt = rs.getTimestamp("created_at").toInstant()
        )
    }

    private fun parseItems(value: String?): List<OrderItem> {
        if (value.isNullOrBlank()) {
            return emptyList()
        }

        return try {
            val tree = objectMapper.readTree(value)
            if (!tree.isArray) {
                return emptyList()
            }

            tree.mapNotNull { node ->
                val sku = node.path("sku").asText("").trim()
                val quantity = node.path("quantity").asInt(0)
                if (sku.isBlank() || quantity <= 0) {
                    null
                } else {
                    OrderItem(sku = sku, quantity = quantity)
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun orderIdToShipmentId(orderId: String): String {
        return if (orderId.startsWith("ord_")) "ship_${orderId.removePrefix("ord_")}" else "ship_$orderId"
    }

    private fun shipmentIdToOrderId(shipmentId: String): String? {
        if (!shipmentId.startsWith("ship_")) {
            return null
        }
        val suffix = shipmentId.removePrefix("ship_")
        if (suffix.isBlank()) {
            return null
        }
        return "ord_$suffix"
    }

    private fun statusToShipmentStatus(orderStatus: String): String {
        return when (orderStatus) {
            OrderStatus.CREATED.name, OrderStatus.RESERVED.name -> "PENDING"
            OrderStatus.PICKING.name -> "LOADING"
            OrderStatus.SHIPPED.name -> "DISPATCHED"
            else -> "FAILED"
        }
    }
}
