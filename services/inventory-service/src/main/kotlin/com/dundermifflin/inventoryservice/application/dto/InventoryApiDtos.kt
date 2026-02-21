package com.dundermifflin.inventoryservice.application.dto

data class ApiError(
    val code: String,
    val message: String
)

data class ApiErrorEnvelope(
    val error: ApiError
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
    val createdAt: String,
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
