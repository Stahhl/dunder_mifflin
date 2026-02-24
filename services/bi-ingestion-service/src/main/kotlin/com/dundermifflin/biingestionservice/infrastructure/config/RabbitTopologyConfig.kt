package com.dundermifflin.biingestionservice.infrastructure.config

import org.springframework.amqp.core.Binding
import org.springframework.amqp.core.BindingBuilder
import org.springframework.amqp.core.Queue
import org.springframework.amqp.core.TopicExchange
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class RabbitTopologyConfig {
    @Bean
    fun domainExchange(biMessagingProperties: BiMessagingProperties): TopicExchange =
        TopicExchange(biMessagingProperties.exchange, true, false)

    @Bean
    fun biDomainEventsQueue(biMessagingProperties: BiMessagingProperties): Queue =
        Queue(biMessagingProperties.queue, true)

    @Bean
    fun orderCreatedBinding(
        domainExchange: TopicExchange,
        biDomainEventsQueue: Queue
    ): Binding {
        return BindingBuilder.bind(biDomainEventsQueue).to(domainExchange).with("order.created.v1")
    }

    @Bean
    fun shipmentDispatchedBinding(
        domainExchange: TopicExchange,
        biDomainEventsQueue: Queue
    ): Binding {
        return BindingBuilder.bind(biDomainEventsQueue).to(domainExchange).with("shipment.dispatched.v1")
    }

    @Bean
    fun expenseDecidedBinding(
        domainExchange: TopicExchange,
        biDomainEventsQueue: Queue
    ): Binding {
        return BindingBuilder.bind(biDomainEventsQueue).to(domainExchange).with("finance.expense.decided.v1")
    }
}
