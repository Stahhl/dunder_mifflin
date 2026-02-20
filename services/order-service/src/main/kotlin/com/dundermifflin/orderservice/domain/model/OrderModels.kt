package com.dundermifflin.orderservice.domain.model

import java.time.Instant
import java.time.LocalDate

enum class OrderStatus {
    CREATED,
    RESERVED,
    PICKING,
    SHIPPED,
    FAILED_INSUFFICIENT_STOCK,
    CANCELLED
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

data class ShipmentWorkItem(
    val shipmentId: String,
    val orderId: String,
    val clientId: String,
    val status: String,
    val requestedShipDate: LocalDate,
    val items: List<OrderItem>,
    val createdAt: Instant
)

data class ScanShipmentCommand(
    val shipmentId: String,
    val barcode: String,
    val quantity: Int,
    val scannedBy: String
)

data class DispatchShipmentCommand(
    val shipmentId: String,
    val truckId: String,
    val dispatchedAt: Instant,
    val dispatchedBy: String,
    val idempotencyKey: String
)

data class DispatchShipmentResult(
    val shipmentId: String,
    val orderId: String,
    val shipmentStatus: String,
    val orderStatus: String,
    val dispatchedAt: Instant
)
