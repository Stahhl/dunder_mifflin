package com.dundermifflin.orderservice.application.controller

import com.dundermifflin.orderservice.application.dto.ApiError
import com.dundermifflin.orderservice.application.dto.ApiErrorEnvelope
import com.dundermifflin.orderservice.application.dto.CreateOrderRequest
import com.dundermifflin.orderservice.application.dto.CreateOrderResponse
import com.dundermifflin.orderservice.application.dto.OrderDetailResponse
import com.dundermifflin.orderservice.application.dto.OrderItemResponse
import com.dundermifflin.orderservice.application.dto.OrderRequestValidator
import com.dundermifflin.orderservice.application.dto.OrderSummaryResponse
import com.dundermifflin.orderservice.application.dto.TimelineEventResponse
import com.dundermifflin.orderservice.domain.model.CreateOrderCommand
import com.dundermifflin.orderservice.domain.model.OrderItem
import com.dundermifflin.orderservice.domain.port.input.OrderUseCase
import jakarta.servlet.http.HttpServletRequest
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
import java.time.LocalDate

@RestController
@RequestMapping("/internal/orders")
class InternalOrderController(
    private val orderUseCase: OrderUseCase,
    private val orderRequestValidator: OrderRequestValidator
) {
    @PostMapping
    fun createOrder(
        request: HttpServletRequest,
        @RequestHeader(name = "x-user-id", required = false) userId: String?,
        @RequestBody(required = false) payload: CreateOrderRequest?
    ): ResponseEntity<Any> {
        val authenticatedUser = userId?.trim()
        if (authenticatedUser.isNullOrBlank()) {
            return unauthenticatedResponse()
        }

        val validationDetails = orderRequestValidator.validate(payload)
        if (validationDetails.isNotEmpty()) {
            return ResponseEntity.badRequest().body(
                ApiErrorEnvelope(
                    error = ApiError(
                        code = "VALIDATION_ERROR",
                        message = "Order request validation failed",
                        details = validationDetails
                    )
                )
            )
        }

        val created = orderUseCase.createOrder(
            CreateOrderCommand(
                clientId = payload!!.clientId!!.trim(),
                requestedShipDate = LocalDate.parse(payload.requestedShipDate!!.trim()),
                items = payload.items!!.map { OrderItem(sku = it.sku!!.trim(), quantity = it.quantity!!) },
                notes = payload.notes ?: "",
                createdBy = authenticatedUser
            )
        )

        return ResponseEntity.status(HttpStatus.CREATED).body(
            CreateOrderResponse(
                orderId = created.orderId,
                status = created.status.name,
                createdAt = created.createdAt
            )
        )
    }

    @GetMapping
    fun listOrders(
        @RequestHeader(name = "x-user-id", required = false) userId: String?,
        @RequestParam(name = "clientId", required = false) clientId: String?
    ): ResponseEntity<Any> {
        if (userId.isNullOrBlank()) {
            return unauthenticatedResponse()
        }

        val items = orderUseCase.listOrders(clientId?.trim()?.takeIf { it.isNotBlank() })
            .map { summary ->
                OrderSummaryResponse(
                    orderId = summary.orderId,
                    clientId = summary.clientId,
                    status = summary.status.name,
                    requestedShipDate = summary.requestedShipDate.toString(),
                    createdAt = summary.createdAt
                )
            }

        return ResponseEntity.ok(
            mapOf(
                "items" to items,
                "total" to items.size
            )
        )
    }

    @GetMapping("/{orderId}")
    fun getOrder(
        @RequestHeader(name = "x-user-id", required = false) userId: String?,
        @PathVariable orderId: String
    ): ResponseEntity<Any> {
        if (userId.isNullOrBlank()) {
            return unauthenticatedResponse()
        }

        val order = orderUseCase.getOrder(orderId)
            ?: return orderNotFound(orderId)

        return ResponseEntity.ok(
            OrderDetailResponse(
                orderId = order.orderId,
                clientId = order.clientId,
                requestedShipDate = order.requestedShipDate.toString(),
                items = order.items.map { OrderItemResponse(sku = it.sku, quantity = it.quantity) },
                notes = order.notes,
                createdBy = order.createdBy,
                status = order.status.name,
                createdAt = order.createdAt,
                shipmentId = order.shipmentId
            )
        )
    }

    @GetMapping("/{orderId}/timeline")
    fun getTimeline(
        @RequestHeader(name = "x-user-id", required = false) userId: String?,
        @PathVariable orderId: String
    ): ResponseEntity<Any> {
        if (userId.isNullOrBlank()) {
            return unauthenticatedResponse()
        }

        val order = orderUseCase.getOrder(orderId)
            ?: return orderNotFound(orderId)

        val events = orderUseCase.getTimeline(orderId).map {
            TimelineEventResponse(
                status = it.status,
                at = it.at,
                source = it.source
            )
        }

        return ResponseEntity.ok(
            mapOf(
                "orderId" to order.orderId,
                "events" to events
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

    private fun orderNotFound(orderId: String): ResponseEntity<Any> = ResponseEntity.status(HttpStatus.NOT_FOUND).body(
        ApiErrorEnvelope(
            error = ApiError(
                code = "ORDER_NOT_FOUND",
                message = "Order $orderId was not found"
            )
        )
    )
}
