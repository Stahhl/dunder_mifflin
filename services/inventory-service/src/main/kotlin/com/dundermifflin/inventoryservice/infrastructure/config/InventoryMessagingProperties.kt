package com.dundermifflin.inventoryservice.infrastructure.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "inventory.messaging")
data class InventoryMessagingProperties(
    val exchange: String = "dm.domain.events",
    val orderEventsQueue: String = "inventory.order-events.q"
)
