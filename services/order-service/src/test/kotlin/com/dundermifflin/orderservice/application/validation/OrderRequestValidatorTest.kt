package com.dundermifflin.orderservice.application.validation

import com.dundermifflin.orderservice.application.dto.CreateOrderRequest
import com.dundermifflin.orderservice.application.dto.OrderItemRequest
import com.dundermifflin.orderservice.application.dto.OrderRequestValidator
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class OrderRequestValidatorTest {
    private val validator = OrderRequestValidator()

    @Test
    fun `returns required and minimum details for invalid payload`() {
        val details = validator.validate(
            CreateOrderRequest(
                clientId = " ",
                requestedShipDate = "bad-date",
                items = listOf(OrderItemRequest(sku = "", quantity = 0)),
                notes = null
            )
        )

        assertTrue(details.any { it.field == "clientId" && it.issue == "required" })
        assertTrue(details.any { it.field == "requestedShipDate" && it.issue == "format:YYYY-MM-DD" })
        assertTrue(details.any { it.field == "items[0].sku" && it.issue == "required" })
        assertTrue(details.any { it.field == "items[0].quantity" && it.issue == "min:1" })
    }

    @Test
    fun `returns empty details for valid payload`() {
        val details = validator.validate(
            CreateOrderRequest(
                clientId = "client_501",
                requestedShipDate = "2026-02-25",
                items = listOf(OrderItemRequest(sku = "PPR-A4-WHT-500", quantity = 10)),
                notes = "ok"
            )
        )

        assertEquals(0, details.size)
    }
}
