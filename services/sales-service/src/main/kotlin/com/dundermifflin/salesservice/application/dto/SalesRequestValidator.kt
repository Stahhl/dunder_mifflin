package com.dundermifflin.salesservice.application.dto

import com.dundermifflin.salesservice.domain.model.LeadStatus
import org.springframework.stereotype.Component

@Component
class SalesRequestValidator {
    fun validateCreateLead(payload: CreateLeadRequest?): List<ApiErrorDetail> {
        if (payload == null) {
            return listOf(ApiErrorDetail(field = "body", issue = "request body is required"))
        }

        val details = mutableListOf<ApiErrorDetail>()
        val companyName = payload.companyName?.trim().orEmpty()
        val contactName = payload.contactName?.trim().orEmpty()
        val contactEmail = payload.contactEmail?.trim().orEmpty()
        val phone = payload.phone?.trim().orEmpty()

        if (companyName.isBlank()) {
            details += ApiErrorDetail(field = "companyName", issue = "companyName is required")
        }
        if (contactName.isBlank()) {
            details += ApiErrorDetail(field = "contactName", issue = "contactName is required")
        }
        if (contactEmail.isBlank()) {
            details += ApiErrorDetail(field = "contactEmail", issue = "contactEmail is required")
        } else if (!contactEmail.contains("@")) {
            details += ApiErrorDetail(field = "contactEmail", issue = "contactEmail must be a valid email")
        }
        if (phone.isBlank()) {
            details += ApiErrorDetail(field = "phone", issue = "phone is required")
        }

        return details
    }

    fun validateUpdateLead(payload: UpdateLeadRequest?): List<ApiErrorDetail> {
        if (payload == null) {
            return listOf(ApiErrorDetail(field = "body", issue = "request body is required"))
        }

        val details = mutableListOf<ApiErrorDetail>()
        val status = payload.status?.trim().orEmpty()
        if (status.isBlank()) {
            details += ApiErrorDetail(field = "status", issue = "status is required")
        } else if (LeadStatus.entries.none { it.name == status }) {
            details += ApiErrorDetail(
                field = "status",
                issue = "status must be one of: ${LeadStatus.entries.joinToString { it.name }}"
            )
        }

        return details
    }
}
