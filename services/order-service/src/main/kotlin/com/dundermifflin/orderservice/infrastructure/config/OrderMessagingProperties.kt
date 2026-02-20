package com.dundermifflin.orderservice.infrastructure.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "order")
data class OrderMessagingProperties(
    val exchange: String = "dm.domain.events"
)
