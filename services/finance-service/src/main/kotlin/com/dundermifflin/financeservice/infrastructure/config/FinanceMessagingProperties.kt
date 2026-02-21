package com.dundermifflin.financeservice.infrastructure.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "finance.messaging")
data class FinanceMessagingProperties(
    val exchange: String = "dm.domain.events"
)
