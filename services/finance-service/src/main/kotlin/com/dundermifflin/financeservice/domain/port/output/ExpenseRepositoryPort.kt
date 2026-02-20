package com.dundermifflin.financeservice.domain.port.output

import com.dundermifflin.financeservice.domain.model.CreateExpenseCommand
import com.dundermifflin.financeservice.domain.model.DecideExpenseCommand
import com.dundermifflin.financeservice.domain.model.Expense
import com.dundermifflin.financeservice.domain.model.ExpenseStatus

interface ExpenseRepositoryPort {
    fun createExpense(command: CreateExpenseCommand): Expense
    fun listExpenses(status: ExpenseStatus?): List<Expense>
    fun getExpenseById(expenseId: String): Expense?
    fun markDecision(command: DecideExpenseCommand): Expense?
}
