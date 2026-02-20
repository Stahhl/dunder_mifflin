package com.dundermifflin.financeservice.domain.model

import java.math.BigDecimal
import java.time.Instant

enum class ExpenseStatus {
    PENDING,
    APPROVED,
    REJECTED
}

enum class ExpenseDecision {
    APPROVED,
    REJECTED
}

data class Expense(
    val expenseId: String,
    val submitterUserId: String,
    val category: String,
    val amount: BigDecimal,
    val currency: String,
    val description: String,
    val receiptUrl: String?,
    val status: ExpenseStatus,
    val createdAt: Instant,
    val decidedBy: String?,
    val decidedAt: Instant?,
    val decisionComment: String?
)

data class CreateExpenseCommand(
    val submitterUserId: String,
    val category: String,
    val amount: BigDecimal,
    val currency: String,
    val description: String,
    val receiptUrl: String?
)

data class DecideExpenseCommand(
    val expenseId: String,
    val decision: ExpenseDecision,
    val comment: String,
    val decidedBy: String,
    val decidedAt: Instant
)

sealed interface ExpenseDecisionResult {
    data class Updated(val expense: Expense) : ExpenseDecisionResult
    data class NotFound(val expenseId: String) : ExpenseDecisionResult
    data class Conflict(val expense: Expense) : ExpenseDecisionResult
}
