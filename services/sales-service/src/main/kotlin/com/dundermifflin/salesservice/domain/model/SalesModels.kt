package com.dundermifflin.salesservice.domain.model

import java.time.Instant

enum class LeadStatus {
    NEW,
    CONTACTED,
    QUALIFIED,
    DISQUALIFIED,
    CONVERTED
}

data class Lead(
    val leadId: String,
    val companyName: String,
    val contactName: String,
    val contactEmail: String,
    val phone: String,
    val status: LeadStatus,
    val notes: String,
    val createdBy: String,
    val createdAt: Instant,
    val updatedAt: Instant,
    val convertedClientId: String?,
    val convertedAt: Instant?
)

data class LeadSummary(
    val leadId: String,
    val companyName: String,
    val contactName: String,
    val contactEmail: String,
    val status: LeadStatus,
    val createdAt: Instant,
    val convertedClientId: String?
)

data class Client(
    val clientId: String,
    val sourceLeadId: String,
    val companyName: String,
    val contactName: String,
    val contactEmail: String,
    val phone: String,
    val createdBy: String,
    val createdAt: Instant
)

data class CreateLeadCommand(
    val companyName: String,
    val contactName: String,
    val contactEmail: String,
    val phone: String,
    val notes: String,
    val createdBy: String
)

data class UpdateLeadCommand(
    val leadId: String,
    val status: LeadStatus,
    val notes: String,
    val updatedBy: String
)

data class ConvertLeadCommand(
    val leadId: String,
    val convertedBy: String
)

sealed interface LeadConversionResult {
    data class Converted(
        val lead: Lead,
        val client: Client,
        val alreadyConverted: Boolean
    ) : LeadConversionResult

    data class NotFound(val leadId: String) : LeadConversionResult

    data class NotQualified(
        val leadId: String,
        val currentStatus: LeadStatus
    ) : LeadConversionResult
}
