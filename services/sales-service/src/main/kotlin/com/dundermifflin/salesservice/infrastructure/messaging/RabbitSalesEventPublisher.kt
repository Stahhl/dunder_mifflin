package com.dundermifflin.salesservice.infrastructure.messaging

import com.dundermifflin.salesservice.domain.model.Client
import com.dundermifflin.salesservice.domain.model.Lead
import com.dundermifflin.salesservice.domain.port.output.SalesEventPublisherPort
import com.dundermifflin.salesservice.infrastructure.config.SalesMessagingProperties
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.amqp.core.MessageDeliveryMode
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.stereotype.Component
import java.util.UUID

private const val LEAD_CONVERTED_EVENT_TYPE = "com.dundermifflin.sales.lead.converted.v1"
private const val LEAD_CONVERTED_ROUTING_KEY = "sales.lead.converted.v1"

@Component
class RabbitSalesEventPublisher(
    private val rabbitTemplate: RabbitTemplate,
    private val objectMapper: ObjectMapper,
    private val salesMessagingProperties: SalesMessagingProperties
) : SalesEventPublisherPort {
    override fun publishLeadConverted(lead: Lead, client: Client, convertedBy: String) {
        val eventId = "evt_${UUID.randomUUID().toString().replace("-", "")}" 
        val occurredAt = lead.convertedAt ?: client.createdAt

        val payload = mapOf(
            "specversion" to "1.0",
            "id" to eventId,
            "type" to LEAD_CONVERTED_EVENT_TYPE,
            "source" to "/sales-service",
            "subject" to "lead/${lead.leadId}",
            "time" to occurredAt.toString(),
            "datacontenttype" to "application/json",
            "data" to mapOf(
                "leadId" to lead.leadId,
                "clientId" to client.clientId,
                "companyName" to client.companyName,
                "contactName" to client.contactName,
                "contactEmail" to client.contactEmail,
                "convertedBy" to convertedBy,
                "convertedAt" to occurredAt.toString()
            )
        )

        val body = objectMapper.writeValueAsString(payload)
        rabbitTemplate.convertAndSend(salesMessagingProperties.exchange, LEAD_CONVERTED_ROUTING_KEY, body) { message ->
            message.messageProperties.contentType = "application/cloudevents+json"
            message.messageProperties.deliveryMode = MessageDeliveryMode.PERSISTENT
            message.messageProperties.messageId = eventId
            message.messageProperties.type = LEAD_CONVERTED_EVENT_TYPE
            message
        }
    }
}
