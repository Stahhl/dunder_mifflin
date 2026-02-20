package com.dundermifflin.financeservice.domain.port.input

import com.dundermifflin.financeservice.domain.model.CreateExpenseCommand
import com.dundermifflin.financeservice.domain.model.DecideExpenseCommand
import com.dundermifflin.financeservice.domain.model.Expense
import com.dundermifflin.financeservice.domain.model.ExpenseDecisionResult
import com.dundermifflin.financeservice.domain.model.ExpenseStatus

interface ExpenseUseCase {
    fun createExpense(command: CreateExpenseCommand): Expense
    fun listExpenses(status: ExpenseStatus?): List<Expense>
    fun decideExpense(command: DecideExpenseCommand): ExpenseDecisionResult
}
