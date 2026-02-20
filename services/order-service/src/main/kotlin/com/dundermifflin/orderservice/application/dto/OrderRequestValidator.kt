package com.dundermifflin.orderservice.application.dto

import org.springframework.stereotype.Component

@Component
class OrderRequestValidator {
    fun validate(payload: CreateOrderRequest?): List<FieldErrorDetail> {
        if (payload == null) {
            return listOf(FieldErrorDetail(field = "body", issue = "required"))
        }

        val details = mutableListOf<FieldErrorDetail>()

        if (payload.clientId.isNullOrBlank()) {
            details += FieldErrorDetail(field = "clientId", issue = "required")
        }

        val requestedShipDate = payload.requestedShipDate?.trim()
        if (requestedShipDate.isNullOrBlank()) {
            details += FieldErrorDetail(field = "requestedShipDate", issue = "required")
        } else if (!requestedShipDate.matches(Regex("^\\d{4}-\\d{2}-\\d{2}$"))) {
            details += FieldErrorDetail(field = "requestedShipDate", issue = "format:YYYY-MM-DD")
        }

        val items = payload.items
        if (items.isNullOrEmpty()) {
            details += FieldErrorDetail(field = "items", issue = "min:1")
        } else {
            items.forEachIndexed { index, item ->
                if (item.sku.isNullOrBlank()) {
                    details += FieldErrorDetail(field = "items[$index].sku", issue = "required")
                }

                if (item.quantity == null || item.quantity <= 0) {
                    details += FieldErrorDetail(field = "items[$index].quantity", issue = "min:1")
                }
            }
        }

        return details
    }
}
