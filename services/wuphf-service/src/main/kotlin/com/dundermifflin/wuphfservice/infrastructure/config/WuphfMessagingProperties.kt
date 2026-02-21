package com.dundermifflin.wuphfservice.infrastructure.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "wuphf.messaging")
data class WuphfMessagingProperties(
    val exchange: String = "dm.domain.events",
    val queue: String = "wuphf.domain-events.q"
)
