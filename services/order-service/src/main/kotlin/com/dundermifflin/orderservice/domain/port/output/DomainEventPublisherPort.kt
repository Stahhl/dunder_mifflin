package com.dundermifflin.orderservice.domain.port.output

import com.dundermifflin.orderservice.domain.model.DispatchShipmentResult
import com.dundermifflin.orderservice.domain.model.Order

interface DomainEventPublisherPort {
    fun publishOrderCreated(order: Order)

    fun publishShipmentDispatched(result: DispatchShipmentResult, dispatchedBy: String, truckId: String)

    fun isHealthy(): Boolean
}
