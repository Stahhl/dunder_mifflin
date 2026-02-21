package com.dundermifflin.orderservice.domain.port.output

import com.dundermifflin.orderservice.domain.model.CreateOrderCommand
import com.dundermifflin.orderservice.domain.model.DispatchShipmentResult
import com.dundermifflin.orderservice.domain.model.Order
import com.dundermifflin.orderservice.domain.model.OrderSummary
import com.dundermifflin.orderservice.domain.model.OrderTimelineEvent
import com.dundermifflin.orderservice.domain.model.ShipmentWorkItem
import java.time.Instant

interface OrderRepositoryPort {
    fun createOrder(command: CreateOrderCommand): Order

    fun listOrders(clientId: String?): List<OrderSummary>

    fun getOrderById(orderId: String): Order?

    fun getTimeline(orderId: String): List<OrderTimelineEvent>

    fun listPendingShipments(): List<ShipmentWorkItem>

    fun getShipmentById(shipmentId: String): ShipmentWorkItem?

    fun markShipmentDispatched(shipmentId: String, dispatchedAt: Instant): DispatchShipmentResult?

    fun applyShipmentDispatchedEvent(orderId: String, shipmentId: String, dispatchedAt: Instant): Boolean

    fun isHealthy(): Boolean
}
