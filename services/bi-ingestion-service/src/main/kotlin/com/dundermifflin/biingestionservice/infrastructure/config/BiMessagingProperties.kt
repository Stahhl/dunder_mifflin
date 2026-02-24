package com.dundermifflin.biingestionservice.infrastructure.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "bi.messaging")
data class BiMessagingProperties(
    val exchange: String = "dm.domain.events",
    val queue: String = "bi.domain-events.q"
)
