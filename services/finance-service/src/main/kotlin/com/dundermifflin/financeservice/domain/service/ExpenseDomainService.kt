package com.dundermifflin.financeservice.domain.service

import com.dundermifflin.financeservice.domain.model.CreateExpenseCommand
import com.dundermifflin.financeservice.domain.model.DecideExpenseCommand
import com.dundermifflin.financeservice.domain.model.Expense
import com.dundermifflin.financeservice.domain.model.ExpenseDecisionResult
import com.dundermifflin.financeservice.domain.model.ExpenseStatus
import com.dundermifflin.financeservice.domain.port.input.ExpenseUseCase
import com.dundermifflin.financeservice.domain.port.output.ExpenseEventPublisherPort
import com.dundermifflin.financeservice.domain.port.output.ExpenseRepositoryPort
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service

@Service
class ExpenseDomainService(
    private val expenseRepositoryPort: ExpenseRepositoryPort,
    private val expenseEventPublisherPort: ExpenseEventPublisherPort
) : ExpenseUseCase {
    private val logger = LoggerFactory.getLogger(ExpenseDomainService::class.java)

    override fun createExpense(command: CreateExpenseCommand): Expense {
        val created = expenseRepositoryPort.createExpense(command)
        try {
            expenseEventPublisherPort.publishExpenseSubmitted(created)
        } catch (exception: Exception) {
            logger.error("Failed to publish finance.expense.submitted.v1 in finance-service", exception)
        }
        return created
    }

    override fun listExpenses(status: ExpenseStatus?): List<Expense> {
        return expenseRepositoryPort.listExpenses(status)
    }

    override fun decideExpense(command: DecideExpenseCommand): ExpenseDecisionResult {
        val existing = expenseRepositoryPort.getExpenseById(command.expenseId)
            ?: return ExpenseDecisionResult.NotFound(command.expenseId)

        if (existing.status != ExpenseStatus.PENDING) {
            return ExpenseDecisionResult.Conflict(existing)
        }

        val updated = expenseRepositoryPort.markDecision(command)
            ?: return ExpenseDecisionResult.NotFound(command.expenseId)

        try {
            expenseEventPublisherPort.publishExpenseDecided(updated)
        } catch (exception: Exception) {
            logger.error("Failed to publish finance.expense.decided.v1 in finance-service", exception)
        }

        return ExpenseDecisionResult.Updated(updated)
    }
}
