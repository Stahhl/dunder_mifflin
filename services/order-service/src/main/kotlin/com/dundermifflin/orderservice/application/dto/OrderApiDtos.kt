package com.dundermifflin.orderservice.application.dto

import java.time.Instant

data class CreateOrderRequest(
    val clientId: String?,
    val requestedShipDate: String?,
    val items: List<OrderItemRequest>?,
    val notes: String? = ""
)

data class OrderItemRequest(
    val sku: String?,
    val quantity: Int?
)

data class FieldErrorDetail(
    val field: String,
    val issue: String
)

data class ApiError(
    val code: String,
    val message: String,
    val details: List<FieldErrorDetail>? = null,
    val traceId: String? = null
)

data class ApiErrorEnvelope(
    val error: ApiError
)

data class CreateOrderResponse(
    val orderId: String,
    val status: String,
    val createdAt: Instant
)

data class OrderSummaryResponse(
    val orderId: String,
    val clientId: String,
    val status: String,
    val requestedShipDate: String,
    val createdAt: Instant
)

data class OrderDetailResponse(
    val orderId: String,
    val clientId: String,
    val requestedShipDate: String,
    val items: List<OrderItemResponse>,
    val notes: String,
    val createdBy: String,
    val status: String,
    val createdAt: Instant,
    val shipmentId: String?
)

data class OrderItemResponse(
    val sku: String,
    val quantity: Int
)

data class TimelineEventResponse(
    val status: String,
    val at: Instant,
    val source: String
)

data class ShipmentItemResponse(
    val sku: String,
    val quantity: Int
)

data class ShipmentSummaryResponse(
    val shipmentId: String,
    val orderId: String,
    val clientId: String,
    val status: String,
    val requestedShipDate: String,
    val createdAt: Instant,
    val items: List<ShipmentItemResponse>
)

data class ScanShipmentRequest(
    val barcode: String?,
    val quantity: Int?
)

data class DispatchShipmentRequest(
    val truckId: String?,
    val dispatchedAt: String?
)
