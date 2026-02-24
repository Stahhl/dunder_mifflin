package com.dundermifflin.biingestionservice.domain.model

import com.fasterxml.jackson.databind.JsonNode
import java.time.Instant

data class DomainEventEnvelope(
    val specVersion: String,
    val eventId: String,
    val eventType: String,
    val source: String,
    val subject: String,
    val occurredAt: Instant,
    val schemaVersion: Int,
    val data: JsonNode
)
