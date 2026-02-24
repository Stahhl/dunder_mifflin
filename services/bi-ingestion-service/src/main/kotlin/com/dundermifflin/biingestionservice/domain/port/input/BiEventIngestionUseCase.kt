package com.dundermifflin.biingestionservice.domain.port.input

interface BiEventIngestionUseCase {
    fun ingest(rawPayload: String, routingKey: String = "")
}
