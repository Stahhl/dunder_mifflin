package com.dundermifflin.financeservice.infrastructure.persistence

import com.dundermifflin.financeservice.domain.model.CreateExpenseCommand
import com.dundermifflin.financeservice.domain.model.DecideExpenseCommand
import com.dundermifflin.financeservice.domain.model.Expense
import com.dundermifflin.financeservice.domain.model.ExpenseStatus
import com.dundermifflin.financeservice.domain.port.output.ExpenseRepositoryPort
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.core.RowMapper
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.sql.ResultSet
import java.sql.Timestamp

@Component
class JdbcExpenseRepositoryAdapter(
    private val jdbcTemplate: JdbcTemplate
) : ExpenseRepositoryPort {
    @Transactional
    override fun createExpense(command: CreateExpenseCommand): Expense {
        val expenseId = jdbcTemplate.queryForObject(
            "SELECT 'exp_' || nextval('finance.expense_number_seq') AS expense_id",
            String::class.java
        ) ?: throw IllegalStateException("Failed to allocate expense id")

        val createdAt = java.time.Instant.now()

        jdbcTemplate.update(
            """
            INSERT INTO finance.expenses (
              expense_id,
              submitter_user_id,
              category,
              amount,
              currency,
              description,
              receipt_url,
              status,
              created_at,
              decided_by,
              decided_at,
              decision_comment
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """.trimIndent(),
            expenseId,
            command.submitterUserId,
            command.category,
            command.amount,
            command.currency,
            command.description,
            command.receiptUrl,
            ExpenseStatus.PENDING.name,
            Timestamp.from(createdAt),
            null,
            null,
            null
        )

        return getExpenseById(expenseId) ?: throw IllegalStateException("Created expense not found")
    }

    override fun listExpenses(status: ExpenseStatus?): List<Expense> {
        val sql: String
        val args: Array<Any>

        if (status == null) {
            sql =
                """
                SELECT
                  expense_id,
                  submitter_user_id,
                  category,
                  amount,
                  currency,
                  description,
                  receipt_url,
                  status,
                  created_at,
                  decided_by,
                  decided_at,
                  decision_comment
                FROM finance.expenses
                ORDER BY created_at DESC, expense_id DESC
                """.trimIndent()
            args = emptyArray()
        } else {
            sql =
                """
                SELECT
                  expense_id,
                  submitter_user_id,
                  category,
                  amount,
                  currency,
                  description,
                  receipt_url,
                  status,
                  created_at,
                  decided_by,
                  decided_at,
                  decision_comment
                FROM finance.expenses
                WHERE status = ?
                ORDER BY created_at DESC, expense_id DESC
                """.trimIndent()
            args = arrayOf(status.name)
        }

        return jdbcTemplate.query(sql, rowMapper, *args)
    }

    override fun getExpenseById(expenseId: String): Expense? {
        val rows = jdbcTemplate.query(
            """
            SELECT
              expense_id,
              submitter_user_id,
              category,
              amount,
              currency,
              description,
              receipt_url,
              status,
              created_at,
              decided_by,
              decided_at,
              decision_comment
            FROM finance.expenses
            WHERE expense_id = ?
            """.trimIndent(),
            rowMapper,
            expenseId
        )

        return rows.firstOrNull()
    }

    @Transactional
    override fun markDecision(command: DecideExpenseCommand): Expense? {
        val updatedRows = jdbcTemplate.update(
            """
            UPDATE finance.expenses
            SET status = ?,
                decided_by = ?,
                decided_at = ?,
                decision_comment = ?
            WHERE expense_id = ?
              AND status = ?
            """.trimIndent(),
            command.decision.name,
            command.decidedBy,
            Timestamp.from(command.decidedAt),
            command.comment,
            command.expenseId,
            ExpenseStatus.PENDING.name
        )

        if (updatedRows == 0) {
            return null
        }

        return getExpenseById(command.expenseId)
    }

    private val rowMapper = RowMapper { rs: ResultSet, _: Int ->
        Expense(
            expenseId = rs.getString("expense_id"),
            submitterUserId = rs.getString("submitter_user_id"),
            category = rs.getString("category"),
            amount = rs.getBigDecimal("amount") ?: BigDecimal.ZERO,
            currency = rs.getString("currency"),
            description = rs.getString("description"),
            receiptUrl = rs.getString("receipt_url"),
            status = ExpenseStatus.valueOf(rs.getString("status")),
            createdAt = rs.getTimestamp("created_at").toInstant(),
            decidedBy = rs.getString("decided_by"),
            decidedAt = rs.getTimestamp("decided_at")?.toInstant(),
            decisionComment = rs.getString("decision_comment")
        )
    }
}
