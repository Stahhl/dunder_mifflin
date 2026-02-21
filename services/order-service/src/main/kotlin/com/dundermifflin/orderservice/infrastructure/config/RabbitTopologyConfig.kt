package com.dundermifflin.orderservice.infrastructure.config

import org.springframework.amqp.core.Binding
import org.springframework.amqp.core.BindingBuilder
import org.springframework.amqp.core.Queue
import org.springframework.amqp.core.TopicExchange
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class RabbitTopologyConfig {
    @Bean
    fun domainExchange(orderMessagingProperties: OrderMessagingProperties): TopicExchange =
        TopicExchange(orderMessagingProperties.exchange, true, false)

    @Bean
    fun orderInventoryEventsQueue(orderMessagingProperties: OrderMessagingProperties): Queue =
        Queue(orderMessagingProperties.inventoryEventsQueue, true)

    @Bean
    fun shipmentDispatchedBinding(
        domainExchange: TopicExchange,
        orderInventoryEventsQueue: Queue
    ): Binding {
        return BindingBuilder.bind(orderInventoryEventsQueue).to(domainExchange).with("shipment.dispatched.v1")
    }
}
