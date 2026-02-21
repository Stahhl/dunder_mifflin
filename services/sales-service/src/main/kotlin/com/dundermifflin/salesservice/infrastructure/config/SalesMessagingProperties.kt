package com.dundermifflin.salesservice.infrastructure.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "sales.messaging")
data class SalesMessagingProperties(
    val exchange: String = "dm.domain.events"
)
