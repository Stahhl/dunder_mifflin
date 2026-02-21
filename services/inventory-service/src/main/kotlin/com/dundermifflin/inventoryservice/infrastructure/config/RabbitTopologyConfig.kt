package com.dundermifflin.inventoryservice.infrastructure.config

import org.springframework.amqp.core.Binding
import org.springframework.amqp.core.BindingBuilder
import org.springframework.amqp.core.Queue
import org.springframework.amqp.core.TopicExchange
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class RabbitTopologyConfig {
    @Bean
    fun domainExchange(inventoryMessagingProperties: InventoryMessagingProperties): TopicExchange {
        return TopicExchange(inventoryMessagingProperties.exchange, true, false)
    }

    @Bean
    fun inventoryOrderEventsQueue(inventoryMessagingProperties: InventoryMessagingProperties): Queue {
        return Queue(inventoryMessagingProperties.orderEventsQueue, true)
    }

    @Bean
    fun orderCreatedBinding(
        domainExchange: TopicExchange,
        inventoryOrderEventsQueue: Queue
    ): Binding {
        return BindingBuilder.bind(inventoryOrderEventsQueue).to(domainExchange).with("order.created.v1")
    }
}
