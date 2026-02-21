package com.dundermifflin.inventoryservice.domain.port.output

import com.dundermifflin.inventoryservice.domain.model.DispatchShipmentResult

interface ShipmentEventPublisherPort {
    fun publishShipmentDispatched(result: DispatchShipmentResult)
}
