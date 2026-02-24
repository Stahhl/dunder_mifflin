package com.dundermifflin.biingestionservice.domain.port.output

import com.dundermifflin.biingestionservice.domain.model.DomainEventEnvelope

interface RawObjectStorePort {
    fun storeRawEventIfMissing(event: DomainEventEnvelope, rawPayload: String)

    fun isAvailable(): Boolean
}
