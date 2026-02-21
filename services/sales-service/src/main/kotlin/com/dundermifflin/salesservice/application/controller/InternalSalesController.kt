package com.dundermifflin.salesservice.application.controller

import com.dundermifflin.salesservice.application.dto.ApiError
import com.dundermifflin.salesservice.application.dto.ApiErrorEnvelope
import com.dundermifflin.salesservice.application.dto.ClientSummaryResponse
import com.dundermifflin.salesservice.application.dto.CreateLeadRequest
import com.dundermifflin.salesservice.application.dto.LeadConversionResponse
import com.dundermifflin.salesservice.application.dto.LeadDetailResponse
import com.dundermifflin.salesservice.application.dto.LeadSummaryResponse
import com.dundermifflin.salesservice.application.dto.SalesRequestValidator
import com.dundermifflin.salesservice.application.dto.UpdateLeadRequest
import com.dundermifflin.salesservice.domain.model.ConvertLeadCommand
import com.dundermifflin.salesservice.domain.model.CreateLeadCommand
import com.dundermifflin.salesservice.domain.model.LeadConversionResult
import com.dundermifflin.salesservice.domain.model.LeadStatus
import com.dundermifflin.salesservice.domain.model.UpdateLeadCommand
import com.dundermifflin.salesservice.domain.port.input.SalesUseCase
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/internal/sales")
class InternalSalesController(
    private val salesUseCase: SalesUseCase,
    private val salesRequestValidator: SalesRequestValidator
) {
    @PostMapping("/leads")
    fun createLead(
        @RequestHeader(name = "x-user-id", required = false) userId: String?,
        @RequestBody(required = false) payload: CreateLeadRequest?
    ): ResponseEntity<Any> {
        val authenticatedUser = userId?.trim()
        if (authenticatedUser.isNullOrBlank()) {
            return unauthenticatedResponse()
        }

        val validationDetails = salesRequestValidator.validateCreateLead(payload)
        if (validationDetails.isNotEmpty()) {
            return ResponseEntity.badRequest().body(
                ApiErrorEnvelope(
                    error = ApiError(
                        code = "VALIDATION_ERROR",
                        message = "Lead request validation failed",
                        details = validationDetails
                    )
                )
            )
        }

        val created = salesUseCase.createLead(
            CreateLeadCommand(
                companyName = payload!!.companyName!!.trim(),
                contactName = payload.contactName!!.trim(),
                contactEmail = payload.contactEmail!!.trim(),
                phone = payload.phone!!.trim(),
                notes = payload.notes?.trim().orEmpty(),
                createdBy = authenticatedUser
            )
        )

        return ResponseEntity.status(HttpStatus.CREATED).body(created.toLeadDetailResponse())
    }

    @GetMapping("/leads")
    fun listLeads(
        @RequestHeader(name = "x-user-id", required = false) userId: String?,
        @RequestParam(name = "status", required = false) status: String?
    ): ResponseEntity<Any> {
        if (userId.isNullOrBlank()) {
            return unauthenticatedResponse()
        }

        val statusFilter = status?.trim()?.takeIf { it.isNotBlank() }
        val parsedStatus = if (statusFilter == null) {
            null
        } else {
            LeadStatus.entries.firstOrNull { it.name == statusFilter }
                ?: return ResponseEntity.badRequest().body(
                    ApiErrorEnvelope(
                        error = ApiError(
                            code = "VALIDATION_ERROR",
                            message = "Invalid status filter",
                            details = listOf(
                                com.dundermifflin.salesservice.application.dto.ApiErrorDetail(
                                    field = "status",
                                    issue = "status must be one of: ${LeadStatus.entries.joinToString { it.name }}"
                                )
                            )
                        )
                    )
                )
        }

        val items = salesUseCase.listLeads(parsedStatus).map {
            LeadSummaryResponse(
                leadId = it.leadId,
                companyName = it.companyName,
                contactName = it.contactName,
                contactEmail = it.contactEmail,
                status = it.status.name,
                createdAt = it.createdAt,
                convertedClientId = it.convertedClientId
            )
        }

        return ResponseEntity.ok(
            mapOf(
                "items" to items,
                "total" to items.size
            )
        )
    }

    @GetMapping("/leads/{leadId}")
    fun getLead(
        @RequestHeader(name = "x-user-id", required = false) userId: String?,
        @PathVariable leadId: String
    ): ResponseEntity<Any> {
        if (userId.isNullOrBlank()) {
            return unauthenticatedResponse()
        }

        val lead = salesUseCase.getLead(leadId)
            ?: return leadNotFound(leadId)

        return ResponseEntity.ok(lead.toLeadDetailResponse())
    }

    @PostMapping("/leads/{leadId}")
    fun updateLead(
        @RequestHeader(name = "x-user-id", required = false) userId: String?,
        @PathVariable leadId: String,
        @RequestBody(required = false) payload: UpdateLeadRequest?
    ): ResponseEntity<Any> {
        val authenticatedUser = userId?.trim()
        if (authenticatedUser.isNullOrBlank()) {
            return unauthenticatedResponse()
        }

        val validationDetails = salesRequestValidator.validateUpdateLead(payload)
        if (validationDetails.isNotEmpty()) {
            return ResponseEntity.badRequest().body(
                ApiErrorEnvelope(
                    error = ApiError(
                        code = "VALIDATION_ERROR",
                        message = "Lead update request validation failed",
                        details = validationDetails
                    )
                )
            )
        }

        val updated = salesUseCase.updateLead(
            UpdateLeadCommand(
                leadId = leadId,
                status = LeadStatus.valueOf(payload!!.status!!.trim()),
                notes = payload.notes?.trim().orEmpty(),
                updatedBy = authenticatedUser
            )
        ) ?: return leadNotFound(leadId)

        return ResponseEntity.ok(updated.toLeadDetailResponse())
    }

    @PostMapping("/leads/{leadId}/convert")
    fun convertLead(
        @RequestHeader(name = "x-user-id", required = false) userId: String?,
        @PathVariable leadId: String
    ): ResponseEntity<Any> {
        val authenticatedUser = userId?.trim()
        if (authenticatedUser.isNullOrBlank()) {
            return unauthenticatedResponse()
        }

        return when (val result = salesUseCase.convertLead(ConvertLeadCommand(leadId = leadId, convertedBy = authenticatedUser))) {
            is LeadConversionResult.NotFound -> leadNotFound(result.leadId)
            is LeadConversionResult.NotQualified -> ResponseEntity.status(HttpStatus.CONFLICT).body(
                ApiErrorEnvelope(
                    error = ApiError(
                        code = "LEAD_NOT_QUALIFIED",
                        message = "Lead ${result.leadId} must be QUALIFIED before conversion",
                        details = listOf(
                            com.dundermifflin.salesservice.application.dto.ApiErrorDetail(
                                field = "status",
                                issue = "current status is ${result.currentStatus.name}"
                            )
                        )
                    )
                )
            )

            is LeadConversionResult.Converted -> ResponseEntity.ok(
                LeadConversionResponse(
                    leadId = result.lead.leadId,
                    clientId = result.client.clientId,
                    convertedAt = result.lead.convertedAt ?: result.client.createdAt,
                    alreadyConverted = result.alreadyConverted
                )
            )
        }
    }

    @GetMapping("/clients")
    fun listClients(
        @RequestHeader(name = "x-user-id", required = false) userId: String?
    ): ResponseEntity<Any> {
        if (userId.isNullOrBlank()) {
            return unauthenticatedResponse()
        }

        val items = salesUseCase.listClients().map {
            ClientSummaryResponse(
                clientId = it.clientId,
                sourceLeadId = it.sourceLeadId,
                companyName = it.companyName,
                contactName = it.contactName,
                contactEmail = it.contactEmail,
                createdAt = it.createdAt
            )
        }

        return ResponseEntity.ok(
            mapOf(
                "items" to items,
                "total" to items.size
            )
        )
    }

    private fun unauthenticatedResponse(): ResponseEntity<Any> = ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
        ApiErrorEnvelope(
            error = ApiError(
                code = "UNAUTHENTICATED",
                message = "x-user-id header is required for internal endpoints"
            )
        )
    )

    private fun leadNotFound(leadId: String): ResponseEntity<Any> = ResponseEntity.status(HttpStatus.NOT_FOUND).body(
        ApiErrorEnvelope(
            error = ApiError(
                code = "LEAD_NOT_FOUND",
                message = "Lead $leadId was not found"
            )
        )
    )
}

private fun com.dundermifflin.salesservice.domain.model.Lead.toLeadDetailResponse(): LeadDetailResponse {
    return LeadDetailResponse(
        leadId = this.leadId,
        companyName = this.companyName,
        contactName = this.contactName,
        contactEmail = this.contactEmail,
        phone = this.phone,
        status = this.status.name,
        notes = this.notes,
        createdBy = this.createdBy,
        createdAt = this.createdAt,
        updatedAt = this.updatedAt,
        convertedClientId = this.convertedClientId,
        convertedAt = this.convertedAt
    )
}
