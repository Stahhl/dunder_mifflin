package com.dundermifflin.inventoryservice.domain.model

import java.time.Instant
import java.time.LocalDate

enum class ShipmentStatus {
    PENDING,
    LOADING,
    DISPATCHED,
    FAILED
}

data class ShipmentItem(
    val sku: String,
    val quantity: Int
)

data class ShipmentSummary(
    val shipmentId: String,
    val orderId: String,
    val clientId: String,
    val requestedShipDate: LocalDate,
    val status: ShipmentStatus,
    val items: List<ShipmentItem>,
    val createdAt: Instant,
    val createdBy: String,
    val dispatchedAt: Instant? = null,
    val dispatchedBy: String? = null,
    val truckId: String? = null
)

data class RecordScanCommand(
    val shipmentId: String,
    val barcode: String,
    val quantity: Int,
    val scannedBy: String,
    val scannedAt: Instant,
    val idempotencyKey: String?
)

data class ScanShipmentResult(
    val shipmentId: String,
    val orderId: String,
    val status: ShipmentStatus,
    val barcode: String,
    val quantity: Int,
    val scannedBy: String,
    val scannedAt: Instant
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
    val orderCreatedBy: String,
    val shipmentStatus: ShipmentStatus,
    val orderStatus: String,
    val dispatchedAt: Instant,
    val dispatchedBy: String,
    val truckId: String,
    val alreadyDispatched: Boolean
)

data class OrderCreatedEvent(
    val eventId: String?,
    val orderId: String,
    val clientId: String,
    val createdBy: String,
    val createdAt: Instant,
    val requestedShipDate: LocalDate,
    val items: List<ShipmentItem>
)
