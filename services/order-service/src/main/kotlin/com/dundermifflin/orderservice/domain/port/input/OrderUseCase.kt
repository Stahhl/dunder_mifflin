package com.dundermifflin.orderservice.domain.port.input

import com.dundermifflin.orderservice.domain.model.ApplyShipmentDispatchedCommand
import com.dundermifflin.orderservice.domain.model.CreateOrderCommand
import com.dundermifflin.orderservice.domain.model.DispatchShipmentCommand
import com.dundermifflin.orderservice.domain.model.DispatchShipmentResult
import com.dundermifflin.orderservice.domain.model.Order
import com.dundermifflin.orderservice.domain.model.OrderSummary
import com.dundermifflin.orderservice.domain.model.OrderTimelineEvent
import com.dundermifflin.orderservice.domain.model.ScanShipmentCommand
import com.dundermifflin.orderservice.domain.model.ShipmentWorkItem

interface OrderUseCase {
    fun createOrder(command: CreateOrderCommand): Order

    fun listOrders(clientId: String?): List<OrderSummary>

    fun getOrder(orderId: String): Order?

    fun getTimeline(orderId: String): List<OrderTimelineEvent>

    fun listPendingShipments(): List<ShipmentWorkItem>

    fun recordScan(command: ScanShipmentCommand): ShipmentWorkItem?

    fun dispatchShipment(command: DispatchShipmentCommand): DispatchShipmentResult?

    fun applyShipmentDispatched(command: ApplyShipmentDispatchedCommand): Boolean
}
