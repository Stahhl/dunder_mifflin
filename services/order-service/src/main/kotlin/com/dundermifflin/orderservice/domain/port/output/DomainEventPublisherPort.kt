package com.dundermifflin.orderservice.domain.port.output

import com.dundermifflin.orderservice.domain.model.Order

interface DomainEventPublisherPort {
    fun publishOrderCreated(order: Order)

    fun isHealthy(): Boolean
}
