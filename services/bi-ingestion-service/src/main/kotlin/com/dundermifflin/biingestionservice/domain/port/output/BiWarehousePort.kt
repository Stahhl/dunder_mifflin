package com.dundermifflin.biingestionservice.domain.port.output

import com.dundermifflin.biingestionservice.domain.model.DomainEventEnvelope

interface BiWarehousePort {
    fun initializeSchema()

    fun upsertRawEvent(event: DomainEventEnvelope, routingKey: String, rawPayload: String)

    fun upsertOrderFact(event: DomainEventEnvelope)

    fun upsertShipmentFact(event: DomainEventEnvelope)

    fun upsertExpenseFact(event: DomainEventEnvelope)

    fun ping(): Boolean
}
