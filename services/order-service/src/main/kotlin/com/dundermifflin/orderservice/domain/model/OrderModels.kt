package com.dundermifflin.orderservice.domain.model

import java.time.Instant
import java.time.LocalDate

enum class OrderStatus {
    CREATED
}

data class OrderItem(
    val sku: String,
    val quantity: Int
)

data class Order(
    val orderId: String,
    val clientId: String,
    val requestedShipDate: LocalDate,
    val items: List<OrderItem>,
    val notes: String,
    val createdBy: String,
    val status: OrderStatus,
    val createdAt: Instant,
    val shipmentId: String?
)

data class OrderSummary(
    val orderId: String,
    val clientId: String,
    val status: OrderStatus,
    val requestedShipDate: LocalDate,
    val createdAt: Instant
)

data class OrderTimelineEvent(
    val status: String,
    val at: Instant,
    val source: String
)

data class CreateOrderCommand(
    val clientId: String,
    val requestedShipDate: LocalDate,
    val items: List<OrderItem>,
    val notes: String,
    val createdBy: String
)
