package com.dundermifflin.salesservice.application.dto

import java.time.Instant

data class CreateLeadRequest(
    val companyName: String?,
    val contactName: String?,
    val contactEmail: String?,
    val phone: String?,
    val notes: String? = ""
)

data class UpdateLeadRequest(
    val status: String?,
    val notes: String? = ""
)

data class ApiErrorEnvelope(
    val error: ApiError
)

data class ApiError(
    val code: String,
    val message: String,
    val details: List<ApiErrorDetail> = emptyList(),
    val traceId: String? = null
)

data class ApiErrorDetail(
    val field: String,
    val issue: String
)

data class LeadSummaryResponse(
    val leadId: String,
    val companyName: String,
    val contactName: String,
    val contactEmail: String,
    val status: String,
    val createdAt: Instant,
    val convertedClientId: String?
)

data class LeadDetailResponse(
    val leadId: String,
    val companyName: String,
    val contactName: String,
    val contactEmail: String,
    val phone: String,
    val status: String,
    val notes: String,
    val createdBy: String,
    val createdAt: Instant,
    val updatedAt: Instant,
    val convertedClientId: String?,
    val convertedAt: Instant?
)

data class LeadConversionResponse(
    val leadId: String,
    val clientId: String,
    val convertedAt: Instant,
    val alreadyConverted: Boolean
)

data class ClientSummaryResponse(
    val clientId: String,
    val sourceLeadId: String,
    val companyName: String,
    val contactName: String,
    val contactEmail: String,
    val createdAt: Instant
)
