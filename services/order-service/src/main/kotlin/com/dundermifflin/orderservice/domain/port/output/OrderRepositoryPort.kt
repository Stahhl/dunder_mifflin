package com.dundermifflin.orderservice.domain.port.output

import com.dundermifflin.orderservice.domain.model.CreateOrderCommand
import com.dundermifflin.orderservice.domain.model.Order
import com.dundermifflin.orderservice.domain.model.OrderSummary
import com.dundermifflin.orderservice.domain.model.OrderTimelineEvent

interface OrderRepositoryPort {
    fun createOrder(command: CreateOrderCommand): Order

    fun listOrders(clientId: String?): List<OrderSummary>

    fun getOrderById(orderId: String): Order?

    fun getTimeline(orderId: String): List<OrderTimelineEvent>

    fun isHealthy(): Boolean
}
