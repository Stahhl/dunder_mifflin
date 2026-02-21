package com.dundermifflin.financeservice.infrastructure.messaging

import com.dundermifflin.financeservice.domain.model.Expense
import com.dundermifflin.financeservice.domain.port.output.ExpenseEventPublisherPort
import com.dundermifflin.financeservice.infrastructure.config.FinanceMessagingProperties
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.amqp.core.MessageDeliveryMode
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.stereotype.Component
import java.util.UUID

private const val EXPENSE_SUBMITTED_EVENT_TYPE = "com.dundermifflin.expense.submitted.v1"
private const val EXPENSE_SUBMITTED_ROUTING_KEY = "finance.expense.submitted.v1"
private const val EXPENSE_DECIDED_EVENT_TYPE = "com.dundermifflin.expense.decided.v1"
private const val EXPENSE_DECIDED_ROUTING_KEY = "finance.expense.decided.v1"

@Component
class RabbitExpenseEventPublisher(
    private val rabbitTemplate: RabbitTemplate,
    private val objectMapper: ObjectMapper,
    private val financeMessagingProperties: FinanceMessagingProperties
) : ExpenseEventPublisherPort {
    override fun publishExpenseSubmitted(expense: Expense) {
        val eventId = "evt_${UUID.randomUUID().toString().replace("-", "")}"
        val payload = mapOf(
            "specversion" to "1.0",
            "id" to eventId,
            "type" to EXPENSE_SUBMITTED_EVENT_TYPE,
            "source" to "/finance-service",
            "subject" to "expense/${expense.expenseId}",
            "time" to expense.createdAt.toString(),
            "datacontenttype" to "application/json",
            "data" to mapOf(
                "expenseId" to expense.expenseId,
                "submitterUserId" to expense.submitterUserId,
                "amount" to expense.amount,
                "currency" to expense.currency,
                "submittedAt" to expense.createdAt.toString()
            )
        )

        val body = objectMapper.writeValueAsString(payload)
        rabbitTemplate.convertAndSend(financeMessagingProperties.exchange, EXPENSE_SUBMITTED_ROUTING_KEY, body) { message ->
            message.messageProperties.contentType = "application/cloudevents+json"
            message.messageProperties.deliveryMode = MessageDeliveryMode.PERSISTENT
            message.messageProperties.messageId = eventId
            message.messageProperties.type = EXPENSE_SUBMITTED_EVENT_TYPE
            message
        }
    }

    override fun publishExpenseDecided(expense: Expense) {
        val decidedAt = expense.decidedAt ?: return
        val decision = expense.status.name
        if (decision != "APPROVED" && decision != "REJECTED") {
            return
        }

        val eventId = "evt_${UUID.randomUUID().toString().replace("-", "")}"
        val payload = mapOf(
            "specversion" to "1.0",
            "id" to eventId,
            "type" to EXPENSE_DECIDED_EVENT_TYPE,
            "source" to "/finance-service",
            "subject" to "expense/${expense.expenseId}",
            "time" to decidedAt.toString(),
            "datacontenttype" to "application/json",
            "data" to mapOf(
                "expenseId" to expense.expenseId,
                "submitterUserId" to expense.submitterUserId,
                "decision" to decision,
                "decidedBy" to expense.decidedBy,
                "comment" to expense.decisionComment,
                "decidedAt" to decidedAt.toString()
            )
        )

        val body = objectMapper.writeValueAsString(payload)
        rabbitTemplate.convertAndSend(financeMessagingProperties.exchange, EXPENSE_DECIDED_ROUTING_KEY, body) { message ->
            message.messageProperties.contentType = "application/cloudevents+json"
            message.messageProperties.deliveryMode = MessageDeliveryMode.PERSISTENT
            message.messageProperties.messageId = eventId
            message.messageProperties.type = EXPENSE_DECIDED_EVENT_TYPE
            message
        }
    }
}
