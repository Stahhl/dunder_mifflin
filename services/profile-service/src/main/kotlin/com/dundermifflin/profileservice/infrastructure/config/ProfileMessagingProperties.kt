package com.dundermifflin.profileservice.infrastructure.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "profile.messaging")
data class ProfileMessagingProperties(
    val exchange: String = "dm.domain.events"
)
