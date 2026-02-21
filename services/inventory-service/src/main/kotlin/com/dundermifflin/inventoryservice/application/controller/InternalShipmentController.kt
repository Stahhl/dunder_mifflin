package com.dundermifflin.inventoryservice.application.controller

import com.dundermifflin.inventoryservice.application.dto.ApiError
import com.dundermifflin.inventoryservice.application.dto.ApiErrorEnvelope
import com.dundermifflin.inventoryservice.application.dto.DispatchShipmentRequest
import com.dundermifflin.inventoryservice.application.dto.ScanShipmentRequest
import com.dundermifflin.inventoryservice.application.dto.ShipmentItemResponse
import com.dundermifflin.inventoryservice.application.dto.ShipmentSummaryResponse
import com.dundermifflin.inventoryservice.domain.model.DispatchShipmentCommand
import com.dundermifflin.inventoryservice.domain.model.RecordScanCommand
import com.dundermifflin.inventoryservice.domain.port.input.InventoryUseCase
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.Instant
import java.util.UUID

@RestController
@RequestMapping("/internal/shipments")
class InternalShipmentController(
    private val inventoryUseCase: InventoryUseCase
) {
    @GetMapping
    fun listShipments(
        @RequestHeader(name = "x-user-id", required = false) userId: String?,
        @RequestParam(name = "status", required = false) status: String?
    ): ResponseEntity<Any> {
        if (userId.isNullOrBlank()) {
            return unauthenticatedResponse()
        }

        if (!status.isNullOrBlank() && status != "PENDING") {
            return ResponseEntity.badRequest().body(
                ApiErrorEnvelope(
                    error = ApiError(
                        code = "VALIDATION_ERROR",
                        message = "Only status=PENDING is supported for this demo"
                    )
                )
            )
        }

        val items = inventoryUseCase.listShipments(status).map { shipment ->
            ShipmentSummaryResponse(
                shipmentId = shipment.shipmentId,
                orderId = shipment.orderId,
                clientId = shipment.clientId,
                status = shipment.status.name,
                requestedShipDate = shipment.requestedShipDate.toString(),
                createdAt = shipment.createdAt.toString(),
                items = shipment.items.map { item ->
                    ShipmentItemResponse(
                        sku = item.sku,
                        quantity = item.quantity
                    )
                }
            )
        }

        return ResponseEntity.ok(
            mapOf(
                "items" to items,
                "total" to items.size
            )
        )
    }

    @PostMapping("/{shipmentId}/scan")
    fun scanShipment(
        @RequestHeader(name = "x-user-id", required = false) userId: String?,
        @RequestHeader(name = "Idempotency-Key", required = false) idempotencyKey: String?,
        @PathVariable shipmentId: String,
        @RequestBody(required = false) payload: ScanShipmentRequest?
    ): ResponseEntity<Any> {
        val authenticatedUser = userId?.trim()
        if (authenticatedUser.isNullOrBlank()) {
            return unauthenticatedResponse()
        }

        val barcode = payload?.barcode?.trim()
        val quantity = payload?.quantity
        if (barcode.isNullOrBlank() || quantity == null || quantity <= 0) {
            return ResponseEntity.badRequest().body(
                ApiErrorEnvelope(
                    error = ApiError(
                        code = "VALIDATION_ERROR",
                        message = "Scan payload validation failed"
                    )
                )
            )
        }

        val result = inventoryUseCase.recordScan(
            RecordScanCommand(
                shipmentId = shipmentId,
                barcode = barcode,
                quantity = quantity,
                scannedBy = authenticatedUser,
                scannedAt = Instant.now(),
                idempotencyKey = idempotencyKey?.trim()?.takeIf { it.isNotBlank() }
            )
        ) ?: return shipmentNotFound(shipmentId)

        return ResponseEntity.ok(
            mapOf(
                "shipmentId" to result.shipmentId,
                "orderId" to result.orderId,
                "status" to result.status.name,
                "lastScan" to mapOf(
                    "barcode" to result.barcode,
                    "quantity" to result.quantity,
                    "scannedBy" to result.scannedBy,
                    "scannedAt" to result.scannedAt.toString()
                )
            )
        )
    }

    @PostMapping("/{shipmentId}/dispatch")
    fun dispatchShipment(
        @RequestHeader(name = "x-user-id", required = false) userId: String?,
        @RequestHeader(name = "Idempotency-Key", required = false) idempotencyKey: String?,
        @PathVariable shipmentId: String,
        @RequestBody(required = false) payload: DispatchShipmentRequest?
    ): ResponseEntity<Any> {
        val authenticatedUser = userId?.trim()
        if (authenticatedUser.isNullOrBlank()) {
            return unauthenticatedResponse()
        }

        val cleanIdempotencyKey = idempotencyKey?.trim()?.takeIf { it.isNotBlank() }
            ?: return ResponseEntity.badRequest().body(
                ApiErrorEnvelope(
                    error = ApiError(
                        code = "VALIDATION_ERROR",
                        message = "Idempotency-Key header is required"
                    )
                )
            )

        val truckId = payload?.truckId?.trim()
        val dispatchedAtRaw = payload?.dispatchedAt?.trim()
        if (truckId.isNullOrBlank() || dispatchedAtRaw.isNullOrBlank()) {
            return ResponseEntity.badRequest().body(
                ApiErrorEnvelope(
                    error = ApiError(
                        code = "VALIDATION_ERROR",
                        message = "Dispatch payload validation failed"
                    )
                )
            )
        }

        val dispatchedAt = try {
            Instant.parse(dispatchedAtRaw)
        } catch (_: Exception) {
            return ResponseEntity.badRequest().body(
                ApiErrorEnvelope(
                    error = ApiError(
                        code = "VALIDATION_ERROR",
                        message = "dispatchedAt must be an ISO-8601 timestamp"
                    )
                )
            )
        }

        val result = inventoryUseCase.dispatchShipment(
            DispatchShipmentCommand(
                shipmentId = shipmentId,
                truckId = truckId,
                dispatchedAt = dispatchedAt,
                dispatchedBy = authenticatedUser,
                idempotencyKey = cleanIdempotencyKey
            )
        ) ?: return shipmentNotFound(shipmentId)

        return ResponseEntity.ok(
            mapOf(
                "shipmentId" to result.shipmentId,
                "orderId" to result.orderId,
                "shipmentStatus" to result.shipmentStatus.name,
                "orderStatus" to result.orderStatus,
                "dispatchedAt" to result.dispatchedAt.toString(),
                "dispatchedBy" to result.dispatchedBy,
                "dispatchId" to "dsp_${UUID.randomUUID().toString().replace("-", "")}",
                "truckId" to result.truckId,
                "alreadyDispatched" to result.alreadyDispatched
            )
        )
    }

    private fun unauthenticatedResponse(): ResponseEntity<Any> = ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
        ApiErrorEnvelope(
            error = ApiError(
                code = "UNAUTHENTICATED",
                message = "x-user-id header is required for internal endpoints"
            )
        )
    )

    private fun shipmentNotFound(shipmentId: String): ResponseEntity<Any> = ResponseEntity.status(HttpStatus.NOT_FOUND).body(
        ApiErrorEnvelope(
            error = ApiError(
                code = "SHIPMENT_NOT_FOUND",
                message = "Shipment $shipmentId was not found"
            )
        )
    )
}
