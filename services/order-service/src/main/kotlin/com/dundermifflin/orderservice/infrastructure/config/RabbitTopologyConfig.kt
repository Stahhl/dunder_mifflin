package com.dundermifflin.orderservice.infrastructure.config

import org.springframework.amqp.core.TopicExchange
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class RabbitTopologyConfig {
    @Bean
    fun domainExchange(orderMessagingProperties: OrderMessagingProperties): TopicExchange =
        TopicExchange(orderMessagingProperties.exchange, true, false)
}
