package com.dundermifflin.financeservice.domain.service

import com.dundermifflin.financeservice.domain.model.CreateExpenseCommand
import com.dundermifflin.financeservice.domain.model.DecideExpenseCommand
import com.dundermifflin.financeservice.domain.model.Expense
import com.dundermifflin.financeservice.domain.model.ExpenseDecisionResult
import com.dundermifflin.financeservice.domain.model.ExpenseStatus
import com.dundermifflin.financeservice.domain.port.input.ExpenseUseCase
import com.dundermifflin.financeservice.domain.port.output.ExpenseRepositoryPort
import org.springframework.stereotype.Service

@Service
class ExpenseDomainService(
    private val expenseRepositoryPort: ExpenseRepositoryPort
) : ExpenseUseCase {
    override fun createExpense(command: CreateExpenseCommand): Expense {
        return expenseRepositoryPort.createExpense(command)
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

        return ExpenseDecisionResult.Updated(updated)
    }
}
