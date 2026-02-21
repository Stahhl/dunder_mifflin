package com.dundermifflin.financeservice.application.dto

import com.dundermifflin.financeservice.domain.model.Expense
import java.math.BigDecimal
import java.time.Instant

data class CreateExpenseRequest(
    val submitterUserId: String?,
    val category: String?,
    val amount: BigDecimal?,
    val currency: String?,
    val description: String?,
    val receiptUrl: String?
)

data class ExpenseDecisionRequest(
    val decision: String?,
    val comment: String?
)

data class ExpenseResponse(
    val expenseId: String,
    val submitterUserId: String,
    val category: String,
    val amount: BigDecimal,
    val currency: String,
    val description: String,
    val receiptUrl: String?,
    val status: String,
    val createdAt: Instant,
    val decidedBy: String?,
    val decidedAt: Instant?,
    val decisionComment: String?
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

fun Expense.toApiResponse(): ExpenseResponse = ExpenseResponse(
    expenseId = expenseId,
    submitterUserId = submitterUserId,
    category = category,
    amount = amount,
    currency = currency,
    description = description,
    receiptUrl = receiptUrl,
    status = status.name,
    createdAt = createdAt,
    decidedBy = decidedBy,
    decidedAt = decidedAt,
    decisionComment = decisionComment
)
