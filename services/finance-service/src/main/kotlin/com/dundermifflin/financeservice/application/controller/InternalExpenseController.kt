package com.dundermifflin.financeservice.application.controller

import com.dundermifflin.financeservice.application.dto.ApiError
import com.dundermifflin.financeservice.application.dto.ApiErrorEnvelope
import com.dundermifflin.financeservice.application.dto.CreateExpenseRequest
import com.dundermifflin.financeservice.application.dto.ExpenseDecisionRequest
import com.dundermifflin.financeservice.application.dto.ExpenseRequestValidator
import com.dundermifflin.financeservice.application.dto.toApiResponse
import com.dundermifflin.financeservice.domain.model.CreateExpenseCommand
import com.dundermifflin.financeservice.domain.model.DecideExpenseCommand
import com.dundermifflin.financeservice.domain.model.ExpenseDecision
import com.dundermifflin.financeservice.domain.model.ExpenseDecisionResult
import com.dundermifflin.financeservice.domain.model.ExpenseStatus
import com.dundermifflin.financeservice.domain.port.input.ExpenseUseCase
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

@RestController
@RequestMapping("/internal/expenses")
class InternalExpenseController(
    private val expenseUseCase: ExpenseUseCase,
    private val expenseRequestValidator: ExpenseRequestValidator
) {
    @PostMapping
    fun createExpense(
        @RequestHeader(name = "x-user-id", required = false) userId: String?,
        @RequestBody(required = false) payload: CreateExpenseRequest?
    ): ResponseEntity<Any> {
        val authenticatedUser = userId?.trim()
        if (authenticatedUser.isNullOrBlank()) {
            return unauthenticatedResponse()
        }

        val validationDetails = expenseRequestValidator.validateCreate(payload)
        if (validationDetails.isNotEmpty()) {
            return ResponseEntity.badRequest().body(
                ApiErrorEnvelope(
                    error = ApiError(
                        code = "VALIDATION_ERROR",
                        message = "Expense request validation failed",
                        details = validationDetails
                    )
                )
            )
        }

        val created = expenseUseCase.createExpense(
            CreateExpenseCommand(
                submitterUserId = payload!!.submitterUserId?.trim().takeUnless { it.isNullOrBlank() } ?: authenticatedUser,
                category = payload.category!!.trim(),
                amount = payload.amount!!,
                currency = payload.currency!!.trim().uppercase(),
                description = payload.description!!.trim(),
                receiptUrl = payload.receiptUrl?.trim()?.takeIf { it.isNotBlank() }
            )
        )

        return ResponseEntity.status(HttpStatus.CREATED).body(created.toApiResponse())
    }

    @GetMapping
    fun listExpenses(
        @RequestHeader(name = "x-user-id", required = false) userId: String?,
        @RequestParam(name = "status", required = false) status: String?
    ): ResponseEntity<Any> {
        if (userId.isNullOrBlank()) {
            return unauthenticatedResponse()
        }

        val parsedStatus = if (status.isNullOrBlank()) {
            null
        } else {
            try {
                ExpenseStatus.valueOf(status.trim().uppercase())
            } catch (_: Exception) {
                return ResponseEntity.badRequest().body(
                    ApiErrorEnvelope(
                        error = ApiError(
                            code = "VALIDATION_ERROR",
                            message = "status must be one of PENDING, APPROVED, REJECTED"
                        )
                    )
                )
            }
        }

        val items = expenseUseCase.listExpenses(parsedStatus).map { it.toApiResponse() }

        return ResponseEntity.ok(
            mapOf(
                "items" to items,
                "total" to items.size
            )
        )
    }

    @PostMapping("/{expenseId}/decision")
    fun decideExpense(
        @RequestHeader(name = "x-user-id", required = false) userId: String?,
        @PathVariable expenseId: String,
        @RequestBody(required = false) payload: ExpenseDecisionRequest?
    ): ResponseEntity<Any> {
        val authenticatedUser = userId?.trim()
        if (authenticatedUser.isNullOrBlank()) {
            return unauthenticatedResponse()
        }

        val validationDetails = expenseRequestValidator.validateDecision(payload)
        if (validationDetails.isNotEmpty()) {
            return ResponseEntity.badRequest().body(
                ApiErrorEnvelope(
                    error = ApiError(
                        code = "VALIDATION_ERROR",
                        message = "Expense decision validation failed",
                        details = validationDetails
                    )
                )
            )
        }

        val decision = ExpenseDecision.valueOf(payload!!.decision!!.trim().uppercase())
        val updated = expenseUseCase.decideExpense(
            DecideExpenseCommand(
                expenseId = expenseId,
                decision = decision,
                comment = payload.comment?.trim().orEmpty(),
                decidedBy = authenticatedUser,
                decidedAt = Instant.now()
            )
        )

        return when (updated) {
            is ExpenseDecisionResult.NotFound -> ResponseEntity.status(HttpStatus.NOT_FOUND).body(
                ApiErrorEnvelope(
                    error = ApiError(
                        code = "EXPENSE_NOT_FOUND",
                        message = "Expense ${updated.expenseId} was not found"
                    )
                )
            )

            is ExpenseDecisionResult.Conflict -> ResponseEntity.status(HttpStatus.CONFLICT).body(
                ApiErrorEnvelope(
                    error = ApiError(
                        code = "INVALID_STATE",
                        message = "Expense ${updated.expense.expenseId} is already ${updated.expense.status.name}"
                    )
                )
            )

            is ExpenseDecisionResult.Updated -> ResponseEntity.ok(updated.expense.toApiResponse())
        }
    }

    private fun unauthenticatedResponse(): ResponseEntity<Any> = ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
        ApiErrorEnvelope(
            error = ApiError(
                code = "UNAUTHENTICATED",
                message = "x-user-id header is required for internal endpoints"
            )
        )
    )
}
