package com.dundermifflin.financeservice.application.dto

import org.springframework.stereotype.Component
import java.math.BigDecimal

@Component
class ExpenseRequestValidator {
    fun validateCreate(payload: CreateExpenseRequest?): List<FieldErrorDetail> {
        if (payload == null) {
            return listOf(
                FieldErrorDetail(field = "body", issue = "required")
            )
        }

        val details = mutableListOf<FieldErrorDetail>()

        if (payload.category.isNullOrBlank()) {
            details += FieldErrorDetail(field = "category", issue = "required")
        }

        if (payload.amount == null || payload.amount <= BigDecimal.ZERO) {
            details += FieldErrorDetail(field = "amount", issue = "must be greater than 0")
        }

        if (payload.currency.isNullOrBlank()) {
            details += FieldErrorDetail(field = "currency", issue = "required")
        }

        if (payload.description.isNullOrBlank()) {
            details += FieldErrorDetail(field = "description", issue = "required")
        }

        return details
    }

    fun validateDecision(payload: ExpenseDecisionRequest?): List<FieldErrorDetail> {
        if (payload == null) {
            return listOf(
                FieldErrorDetail(field = "body", issue = "required")
            )
        }

        val details = mutableListOf<FieldErrorDetail>()
        val decision = payload.decision?.trim()

        if (decision.isNullOrBlank()) {
            details += FieldErrorDetail(field = "decision", issue = "required")
        } else if (decision != "APPROVED" && decision != "REJECTED") {
            details += FieldErrorDetail(field = "decision", issue = "must be APPROVED or REJECTED")
        }

        if (decision == "REJECTED" && payload.comment.isNullOrBlank()) {
            details += FieldErrorDetail(field = "comment", issue = "required for REJECTED")
        }

        return details
    }
}
