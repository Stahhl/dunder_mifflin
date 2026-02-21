package com.dundermifflin.financeservice.domain.port.output

import com.dundermifflin.financeservice.domain.model.Expense

interface ExpenseEventPublisherPort {
    fun publishExpenseSubmitted(expense: Expense)

    fun publishExpenseDecided(expense: Expense)
}
