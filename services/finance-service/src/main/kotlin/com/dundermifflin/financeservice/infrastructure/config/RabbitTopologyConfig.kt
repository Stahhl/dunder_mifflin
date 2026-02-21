package com.dundermifflin.financeservice.infrastructure.config

import org.springframework.amqp.core.TopicExchange
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class RabbitTopologyConfig {
    @Bean
    fun financeDomainExchange(financeMessagingProperties: FinanceMessagingProperties): TopicExchange {
        return TopicExchange(financeMessagingProperties.exchange, true, false)
    }
}
