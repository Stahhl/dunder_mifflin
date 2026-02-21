package com.dundermifflin.wuphfservice.infrastructure.config

import org.springframework.amqp.core.Binding
import org.springframework.amqp.core.BindingBuilder
import org.springframework.amqp.core.Queue
import org.springframework.amqp.core.TopicExchange
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class RabbitTopologyConfig {
    @Bean
    fun domainExchange(wuphfMessagingProperties: WuphfMessagingProperties): TopicExchange {
        return TopicExchange(wuphfMessagingProperties.exchange, true, false)
    }

    @Bean
    fun wuphfDomainEventsQueue(wuphfMessagingProperties: WuphfMessagingProperties): Queue {
        return Queue(wuphfMessagingProperties.queue, true)
    }

    @Bean
    fun orderCreatedBinding(
        domainExchange: TopicExchange,
        wuphfDomainEventsQueue: Queue
    ): Binding {
        return BindingBuilder.bind(wuphfDomainEventsQueue).to(domainExchange).with("order.created.v1")
    }

    @Bean
    fun shipmentDispatchedBinding(
        domainExchange: TopicExchange,
        wuphfDomainEventsQueue: Queue
    ): Binding {
        return BindingBuilder.bind(wuphfDomainEventsQueue).to(domainExchange).with("shipment.dispatched.v1")
    }

    @Bean
    fun expenseDecidedBinding(
        domainExchange: TopicExchange,
        wuphfDomainEventsQueue: Queue
    ): Binding {
        return BindingBuilder.bind(wuphfDomainEventsQueue).to(domainExchange).with("finance.expense.decided.v1")
    }
}
