package com.dundermifflin.biingestionservice.infrastructure.messaging

import com.dundermifflin.biingestionservice.domain.port.input.BiEventIngestionUseCase
import org.slf4j.LoggerFactory
import org.springframework.amqp.rabbit.annotation.RabbitListener
import org.springframework.amqp.support.AmqpHeaders
import org.springframework.messaging.handler.annotation.Header
import org.springframework.stereotype.Component

@Component
class DomainEventConsumer(
    private val biEventIngestionUseCase: BiEventIngestionUseCase
) {
    private val logger = LoggerFactory.getLogger(DomainEventConsumer::class.java)

    @RabbitListener(queues = ["\${bi.messaging.queue}"])
    fun consume(
        rawPayload: String,
        @Header(name = AmqpHeaders.RECEIVED_ROUTING_KEY, required = false) routingKey: String?
    ) {
        try {
            biEventIngestionUseCase.ingest(rawPayload, routingKey.orEmpty())
        } catch (exception: Exception) {
            logger.error("Failed to ingest BI domain event", exception)
            throw exception
        }
    }
}
